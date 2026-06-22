/**
 * gbp-verify — read the public GBP via the least-friction path (Gemini grounding
 * preferred) and compare against the harvested NAP/categories in client-facts.
 * Writes gbp-verify.json with the comparison and suggested updates, and marks the
 * intake checklist item.
 */

import { renderPrompt } from "../lib/prompts.js";
import { callClaude, parseJsonOutput } from "../lib/anthropic.js";
import { groundedQuery, geminiAvailable } from "../lib/gemini.js";
import { api } from "../lib/apiClient.js";
import { getClientRow } from "../lib/db.js";
import { buildContext } from "./context.js";
import { type JobHandler, type HandlerResult, paramString } from "../lib/types.js";

export const gbpVerify: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const client = await getClientRow(payload.clientId);
  const businessName = client?.businessName ?? payload.clientSlug;
  const ctx = await buildContext(payload.clientSlug, client?.siteType ?? "home_services");

  // Least-friction read: Gemini grounding first. If no read path is available
  // (or it fails), we still write what we can but flag the job needs_review so
  // the team confirms NAP before content generation rather than silently
  // trusting unverified data.
  let gbpData = paramString(payload.params, "gbpData");
  let unverifiedReason = "";
  if (!gbpData) {
    if (geminiAvailable()) {
      log.push("Reading GBP via Gemini grounding");
      try {
        gbpData = await groundedQuery(
          `Find the Google Business Profile details for "${businessName}". Report the business name, full address, phone number, hours, primary category, additional categories, and service areas exactly as listed. If a field is not available, say "not found".`
        );
        if (!gbpData.trim()) {
          unverifiedReason = "Gemini grounding returned no GBP data";
          gbpData = "GBP data unavailable: grounded query returned empty.";
        }
      } catch (err) {
        unverifiedReason = `Gemini grounding failed: ${err instanceof Error ? err.message : String(err)}`;
        log.push(unverifiedReason);
        gbpData = "GBP data unavailable: Gemini grounding call failed.";
      }
    } else {
      unverifiedReason = "GEMINI_API_KEY not configured — no least-friction GBP read path available";
      log.push(unverifiedReason);
      gbpData = "GBP data unavailable: no least-friction read path configured.";
    }
  }

  const prompt = renderPrompt("gbp-verify", {
    client_facts: ctx.clientFacts,
    gbp_data: gbpData,
    vertical_config: ctx.verticalConfig,
  });

  const raw = await callClaude(prompt, { budget: "page" });
  let result: unknown;
  try {
    result = parseJsonOutput(raw);
  } catch {
    result = { raw_text: raw, gbp_source: gbpData };
  }

  await api.writeFile(payload.clientSlug, "gbp-verify.json", JSON.stringify(result, null, 2), "application/json");

  if (unverifiedReason) {
    // NAP could not be verified. Do NOT auto-complete the intake item — leave it
    // open (in_progress) so the team confirms NAP, and flag the job needs_review.
    await api.completeChecklistItem(payload.clientSlug, "gbp_verify job complete", "in_progress").catch(() => undefined);
    log.push("GBP/NAP unverified — flagging job for team review before content generation");
    return {
      outputFiles: ["gbp-verify.json"],
      log,
      status: "needs_review",
      errorMessage: `GBP/NAP unverified: ${unverifiedReason}`,
    };
  }

  await api.completeChecklistItem(payload.clientSlug, "gbp_verify job complete").catch(() => undefined);
  return { outputFiles: ["gbp-verify.json"], log };
};
