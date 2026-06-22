/**
 * gap-report — compare the existing site against the LLS page taxonomy + required
 * client-facts fields, and write gap-report.md. Reads url-inventory.csv if present.
 */

import { renderPrompt } from "../lib/prompts.js";
import { callClaude } from "../lib/anthropic.js";
import { api } from "../lib/apiClient.js";
import { getClientRow } from "../lib/db.js";
import { buildContext } from "./context.js";
import { kbDoc } from "../kb-cache.js";
import { type JobHandler, type HandlerResult, paramString } from "../lib/types.js";

const TAXONOMY_FALLBACK = `LLS page taxonomy (home services): home, service hub, one page per primary
service, one location page per service-area city, about, contact, FAQ. Word count
bands: home 800-1400, service 700-1200, service-hub 500-900, location 600-1000,
about 500-900, contact 150-400, faq 400-800.`;

export const gapReport: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const client = await getClientRow(payload.clientId);
  const ctx = await buildContext(payload.clientSlug, client?.siteType ?? "home_services");

  const siteInventory = paramString(payload.params, "siteInventory");
  const imageInventory = paramString(payload.params, "imageInventory") || "No image inventory provided.";

  const prompt = renderPrompt("gap-report", {
    client_facts: ctx.clientFacts,
    image_standard: kbDoc("L40-22-Image-Standard.md") || "Image Standard L40-22: four-tier hierarchy (client photos, GBP photos, AI generation, licensed stock). Proof pages are real-only. Test: does the image imply something untrue?",
    taxonomy: kbDoc("LLS-Website-Complete-Specification.md") || TAXONOMY_FALLBACK,
    site_inventory: siteInventory || "See url-inventory.csv in the workspace.",
    image_inventory: imageInventory,
  });

  const report = await callClaude(prompt, { budget: "page" });
  await api.writeFile(payload.clientSlug, "gap-report.md", report, "text/markdown");
  await api.completeChecklistItem(payload.clientSlug, "gap_report job complete").catch(() => undefined);

  return { outputFiles: ["gap-report.md"], log };
};
