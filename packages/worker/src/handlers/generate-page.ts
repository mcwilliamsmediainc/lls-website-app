/**
 * generate-page — core content generation.
 *
 * Reads the page-type prompt template, injects client facts + style rules + vertical
 * config + reading level + word count targets, calls Claude, runs the style gate,
 * writes the .md to the workspace, and upserts the content_pages record with the
 * gate result and [VERIFY] flag count.
 */

import { runStyleGate, summarizeFailure, loadWordCountTargets } from "@lls/style-gate";
import { renderPrompt } from "../lib/prompts.js";
import { callClaude } from "../lib/anthropic.js";
import { api } from "../lib/apiClient.js";
import { buildContext } from "./context.js";
import { getClientVertical } from "../lib/db.js";
import { type JobHandler, type HandlerResult, paramString } from "../lib/types.js";

const PAGE_PROMPTS: Record<string, string> = {
  home: "generate-page-home",
  service: "generate-page-service",
  "service-hub": "generate-page-service",
  location: "generate-page-location",
  about: "generate-page-about",
  contact: "generate-page-contact",
};

function readingBandFor(pageType: string, explicit: string): { min: number; max: number } | undefined {
  if (explicit) {
    const [min, max] = explicit.split("-").map(Number);
    if (Number.isFinite(min) && Number.isFinite(max)) return { min: min!, max: max! };
  }
  // Default: residential-leaning pages 6-7, commercial/service pages 9-10.
  if (["about", "contact", "home"].includes(pageType)) return { min: 6, max: 8 };
  return { min: 9, max: 11 };
}

export const generatePage: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const { params } = payload;
  const pageType = paramString(params, "pageType", "service");
  const slug = paramString(params, "slug") || pageType;
  const keyword = paramString(params, "keyword");
  const service = paramString(params, "service");
  const city = paramString(params, "city");
  const titleParam = paramString(params, "title");
  const readingLevelTarget = paramString(params, "readingLevelTarget");

  const promptName = PAGE_PROMPTS[pageType];
  if (!promptName) {
    return { outputFiles: [], log: [`Unknown page type: ${pageType}`], status: "failed", errorMessage: `Unknown page type: ${pageType}` };
  }

  const vertical = await getClientVertical(payload.clientId);
  const ctx = await buildContext(payload.clientSlug, vertical);
  log.push(`Context built (vertical=${vertical}, kb age ${ctx.kb.ageMinutes}m${ctx.kb.stale ? ", STALE" : ""})`);

  const targets = loadWordCountTargets();
  const wcTarget = targets[pageType] ?? targets.service!;
  const readingBand = readingBandFor(pageType, readingLevelTarget);

  const prompt = renderPrompt(promptName, {
    client_facts: ctx.clientFacts,
    style_rules: ctx.styleRules,
    vertical_config: ctx.verticalConfig,
    reading_level_target: readingBand ? `${readingBand.min}-${readingBand.max}` : "default",
    word_count_target: `${wcTarget.min}-${wcTarget.max}`,
    service,
    city,
    keyword,
  });

  log.push(`Calling Claude for ${pageType} page (slug=${slug})`);
  const content = await callClaude(prompt, { budget: "page" });

  // Style gate (hard block).
  const gate = runStyleGate({
    content,
    pageType,
    wordCountTarget: wcTarget,
    readingLevelTarget: readingBand,
  });
  log.push(`Gate: ${gate.pass ? "PASS" : "FAIL"} (words ${gate.wordCount}, grade ${gate.readingGrade}, ${gate.verifyFlags.length} [VERIFY] flags)`);
  if (gate.unflaggedClaims.length) {
    log.push(`Warning: ${gate.unflaggedClaims.length} claim(s) may need [VERIFY]`);
  }

  // Always write the draft so the team can see it, even on gate failure.
  const filePath = `pages/${slug}.md`;
  await api.writeFile(payload.clientSlug, filePath, content, "text/markdown");

  const title = titleParam || (content.match(/^#\s+(.+)$/m)?.[1] ?? slug);
  await api.upsertContentPage({
    clientSlug: payload.clientSlug,
    pageType,
    slug,
    title,
    wordCount: gate.wordCount,
    verifyFlagsCount: gate.verifyFlags.length,
    gateStatus: gate.pass ? "passing" : "failed",
    gateFailureReason: summarizeFailure(gate),
  });

  if (!gate.pass) {
    return {
      outputFiles: [filePath],
      log,
      status: "gate_failed",
      errorMessage: summarizeFailure(gate) ?? "Style gate failed",
    };
  }

  // Mark the relevant content checklist item complete where it maps cleanly.
  const checklistMap: Record<string, string> = {
    home: "Home page generated",
    about: "About page generated",
    contact: "Contact page generated",
  };
  const item = checklistMap[pageType];
  if (item) await api.completeChecklistItem(payload.clientSlug, item).catch(() => undefined);

  return { outputFiles: [filePath], log };
};
