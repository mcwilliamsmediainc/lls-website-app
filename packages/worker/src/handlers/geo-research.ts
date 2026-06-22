/**
 * geo-research — source genuine local facts for one service-area city. Prefers
 * Gemini grounding for current local data, then has Claude structure it into the
 * city-swap-ready fact set. Writes geo/<city>.json and appends a per-city section
 * to the workspace, marking the per-city checklist item.
 */

import { renderPrompt } from "../lib/prompts.js";
import { callClaude, parseJsonOutput } from "../lib/anthropic.js";
import { groundedQuery, geminiAvailable } from "../lib/gemini.js";
import { api } from "../lib/apiClient.js";
import { getClientRow } from "../lib/db.js";
import { buildContext } from "./context.js";
import { type JobHandler, type HandlerResult, paramString } from "../lib/types.js";

function citySlug(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const geoResearch: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const client = await getClientRow(payload.clientId);
  const vertical = client?.siteType ?? "home_services";
  const city = paramString(payload.params, "city");
  const state = paramString(payload.params, "state");
  if (!city) {
    return { outputFiles: [], log: ["No city provided"], status: "failed", errorMessage: "city param required" };
  }

  const ctx = await buildContext(payload.clientSlug, vertical);

  let grounding = "";
  if (geminiAvailable()) {
    log.push(`Grounding local facts for ${city}, ${state}`);
    grounding = await groundedQuery(
      `Give verifiable local facts about ${city}, ${state}: notable neighborhoods and districts, typical housing stock and age, water/soil/climate conditions, and recognizable landmarks. Only include facts you are confident are accurate.`
    );
  }

  const prompt =
    renderPrompt("geo-research", {
      client_facts: ctx.clientFacts,
      vertical_config: ctx.verticalConfig,
      city,
      vertical,
    }) + (grounding ? `\n\n## Grounding data\n${grounding}` : "");

  const raw = await callClaude(prompt, { budget: "page" });
  let facts: unknown;
  try {
    facts = parseJsonOutput(raw);
  } catch {
    facts = { city, state, raw_text: raw };
  }

  const path = `geo/${citySlug(city)}.json`;
  await api.writeFile(payload.clientSlug, path, JSON.stringify(facts, null, 2), "application/json");

  // Mark the per-city checklist item if it exists (created as "... (City)").
  await api
    .completeChecklistItem(payload.clientSlug, `geo_research job complete (${city})`)
    .catch(() => undefined);

  return { outputFiles: [path], log };
};
