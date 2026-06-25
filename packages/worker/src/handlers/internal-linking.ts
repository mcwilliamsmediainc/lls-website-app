/**
 * internal-linking — inject relevant internal links across all pages.
 *
 * HARD DEPENDENCY (spec Table 26): does not run until every Phase 1 content page
 * is approved; otherwise the job is held.
 *
 * To stay within the model's output budget at scale (35+ pages would truncate a
 * single call), pages are processed in small batches. Each batch call receives
 * only title + slug + a short excerpt per page, plus the full page index as link
 * targets, and returns suggested internal links as JSON. The links are then
 * applied to the page markdown in MinIO. The style gate is re-run on every
 * modified page.
 */

import { runStyleGate, summarizeFailure } from "@lls/style-gate";
import { callClaude, parseJsonOutput } from "../lib/anthropic.js";
import { api } from "../lib/apiClient.js";
import { type JobHandler, type HandlerResult } from "../lib/types.js";

const BATCH_SIZE = 9; // 8-10 pages per Claude call
const MAX_TOKENS = 4000; // per batch call
const LINKS_PER_PAGE = 4; // upper bound suggested to the model

interface LinkSpec {
  anchor: string;
  target: string;
}
type BatchLinks = Record<string, LinkSpec[]>;

function pageTypeFromSlug(slug: string): string {
  if (slug.includes("home")) return "home";
  if (slug.includes("about")) return "about";
  if (slug.includes("contact")) return "contact";
  if (slug.includes("location")) return "location";
  if (slug.includes("service")) return "service";
  return "service";
}

function titleOf(content: string, slug: string): string {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? slug;
}

/** Plain-text excerpt (first ~`words` words) with markdown syntax stripped. */
function excerpt(content: string, words = 100): string {
  const body = content
    .replace(/^#.*$/gm, " ") // drop heading lines
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // unwrap existing links
    .replace(/[#*_>`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return body.split(" ").slice(0, words).join(" ");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Insert a markdown link on the first un-linked occurrence of `anchor`. */
function applyLink(content: string, anchor: string, target: string): { applied: boolean; content: string } {
  const esc = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Skip occurrences already inside a markdown link (preceded by '[' or the start of '](').
  const re = new RegExp(`(?<!\\[)${esc}(?!\\]\\()`);
  if (!re.test(content)) return { applied: false, content };
  return { applied: true, content: content.replace(re, `[${anchor}](${target})`) };
}

export const internalLinking: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];

  const approval = await api.allContentApproved(payload.clientSlug);
  if (!approval.allApproved) {
    log.push(`Held: not all content pages are approved (${approval.total} pages)`);
    return { outputFiles: [], log, status: "held", errorMessage: "Internal linking requires all content pages approved" };
  }

  const pages = await api.getPages(payload.clientSlug);
  if (!pages.length) {
    return { outputFiles: [], log: ["No pages found to link"], status: "failed", errorMessage: "No pages" };
  }

  // Full index of valid link targets (every page).
  const targetIndex = pages.map((p) => `- /${p.slug}: ${titleOf(p.content, p.slug)}`).join("\n");

  // Collect link suggestions one small batch at a time.
  const batches = chunk(pages, BATCH_SIZE);
  const allLinks: BatchLinks = {};
  let batchFailures = 0;

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    if (!batch) continue;
    const batchBlock = batch
      .map((p) => `### ${p.slug}\ntitle: ${titleOf(p.content, p.slug)}\nexcerpt: ${excerpt(p.content)}`)
      .join("\n\n");

    const prompt = [
      "You add internal links between pages of one law firm website.",
      "",
      "ALL PAGES (valid link targets, path: title):",
      targetIndex,
      "",
      `PAGES TO LINK (batch ${b + 1}/${batches.length}):`,
      batchBlock,
      "",
      `For each page slug in this batch, suggest up to ${LINKS_PER_PAGE} internal links to OTHER pages.`,
      "Rules:",
      "- anchor MUST be an exact phrase that appears verbatim in that page's excerpt.",
      "- target MUST be one of the paths listed above.",
      "- never link a page to itself; do not repeat an anchor within a page.",
      "- prefer descriptive noun-phrase anchors such as a practice area or city name.",
      'Return ONLY JSON, no prose or code fences: { "<slug>": [ { "anchor": "<exact phrase>", "target": "/<slug>" } ] }',
    ].join("\n");

    try {
      const raw = await callClaude(prompt, { maxTokens: MAX_TOKENS });
      const parsed = parseJsonOutput<BatchLinks>(raw);
      for (const [slug, links] of Object.entries(parsed)) {
        if (Array.isArray(links)) allLinks[slug] = links;
      }
      log.push(`Batch ${b + 1}/${batches.length} (${batch.length} pages): ${Object.keys(parsed).length} page(s) with links`);
    } catch {
      batchFailures++;
      log.push(`Batch ${b + 1}/${batches.length} returned invalid JSON; skipped`);
    }
  }

  // Apply links to each page's markdown and write back to MinIO.
  const outputs: string[] = [];
  let gateFailures = 0;
  let totalLinks = 0;

  for (const p of pages) {
    const links = allLinks[p.slug];
    if (!Array.isArray(links) || links.length === 0) continue;

    let content = p.content;
    let applied = 0;
    const used = new Set<string>();
    for (const link of links) {
      if (!link?.anchor || !link?.target) continue;
      const targetSlug = link.target.replace(/^\//, "").replace(/\/$/, "");
      if (targetSlug === p.slug) continue; // no self-link
      if (!pages.some((q) => q.slug === targetSlug)) continue; // target must exist
      if (used.has(link.anchor)) continue; // one link per anchor
      const res = applyLink(content, link.anchor, `/${targetSlug}`);
      if (res.applied) {
        content = res.content;
        used.add(link.anchor);
        applied++;
      }
    }
    if (applied === 0) continue;

    const gate = runStyleGate({ content, pageType: pageTypeFromSlug(p.slug) });
    await api.writeFile(payload.clientSlug, `pages/${p.slug}.md`, content, "text/markdown");
    outputs.push(`pages/${p.slug}.md`);
    totalLinks += applied;
    if (!gate.pass) {
      gateFailures++;
      log.push(`Post-link gate FAIL on ${p.slug}: ${summarizeFailure(gate)}`);
      await api.upsertContentPage({
        clientSlug: payload.clientSlug,
        pageType: pageTypeFromSlug(p.slug),
        slug: p.slug,
        wordCount: gate.wordCount,
        verifyFlagsCount: gate.verifyFlags.length,
        gateStatus: "failed",
        gateFailureReason: summarizeFailure(gate),
      });
    }
  }

  log.push(`Applied ${totalLinks} internal link(s) across ${outputs.length} page(s) in ${batches.length} batch(es)`);

  if (batches.length > 0 && batchFailures === batches.length) {
    return { outputFiles: outputs, log, status: "failed", errorMessage: "All linking batches returned invalid JSON" };
  }
  if (gateFailures > 0) {
    return { outputFiles: outputs, log, status: "gate_failed", errorMessage: `${gateFailures} page(s) failed the gate after linking` };
  }

  await api.completeChecklistItem(payload.clientSlug, "Internal linking pass complete (only after all pages approved)").catch(() => undefined);
  return { outputFiles: outputs, log };
};
