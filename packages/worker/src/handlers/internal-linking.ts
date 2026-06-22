/**
 * internal-linking — inject relevant internal links across all pages.
 *
 * HARD DEPENDENCY (spec Table 26): this job does not run until every Phase 1
 * content page is approved. If not, the job is held with a clear message. After
 * linking, the style gate is re-run on each page; any page that now fails is
 * written back and flagged so the team can fix it.
 */

import { runStyleGate, summarizeFailure } from "@lls/style-gate";
import { renderPrompt } from "../lib/prompts.js";
import { callClaude, parseJsonOutput } from "../lib/anthropic.js";
import { api } from "../lib/apiClient.js";
import { getClientRow } from "../lib/db.js";
import { buildContext } from "./context.js";
import { type JobHandler, type HandlerResult } from "../lib/types.js";

function pageTypeFromSlug(slug: string): string {
  if (slug.includes("home")) return "home";
  if (slug.includes("about")) return "about";
  if (slug.includes("contact")) return "contact";
  if (slug.includes("location")) return "location";
  if (slug.includes("service")) return "service";
  return "service";
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

  const client = await getClientRow(payload.clientId);
  const ctx = await buildContext(payload.clientSlug, client?.siteType ?? "home_services");

  const pageIndex = pages.map((p) => `- ${p.slug}: ${p.content.match(/^#\s+(.+)$/m)?.[1] ?? p.slug}`).join("\n");
  const pagesBlock = pages.map((p) => `### slug: ${p.slug}\n${p.content}`).join("\n\n---\n\n");

  const prompt = renderPrompt("internal-linking", {
    style_rules: ctx.styleRules,
    page_index: pageIndex,
    pages: pagesBlock,
  });

  const raw = await callClaude(prompt, { budget: "page" });
  let updated: Record<string, string>;
  try {
    updated = parseJsonOutput<Record<string, string>>(raw);
  } catch {
    return { outputFiles: [], log: [...log, "Linking output was not valid JSON"], status: "failed", errorMessage: "Invalid linking output" };
  }

  const outputs: string[] = [];
  let gateFailures = 0;
  for (const [slug, content] of Object.entries(updated)) {
    const gate = runStyleGate({ content, pageType: pageTypeFromSlug(slug) });
    await api.writeFile(payload.clientSlug, `pages/${slug}.md`, content, "text/markdown");
    outputs.push(`pages/${slug}.md`);
    if (!gate.pass) {
      gateFailures++;
      log.push(`Post-link gate FAIL on ${slug}: ${summarizeFailure(gate)}`);
      await api.upsertContentPage({
        clientSlug: payload.clientSlug,
        pageType: pageTypeFromSlug(slug),
        slug,
        wordCount: gate.wordCount,
        verifyFlagsCount: gate.verifyFlags.length,
        gateStatus: "failed",
        gateFailureReason: summarizeFailure(gate),
      });
    }
  }

  if (gateFailures > 0) {
    return { outputFiles: outputs, log, status: "gate_failed", errorMessage: `${gateFailures} page(s) failed the gate after linking` };
  }

  await api.completeChecklistItem(payload.clientSlug, "Internal linking pass complete (only after all pages approved)").catch(() => undefined);
  return { outputFiles: outputs, log };
};
