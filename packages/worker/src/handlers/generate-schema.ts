/**
 * generate-schema — produce JSON-LD for one page, excluding any [VERIFY]-flagged
 * content. Writes schema/<slug>.json to the workspace.
 */

import { renderPrompt } from "../lib/prompts.js";
import { callClaude, parseJsonOutput } from "../lib/anthropic.js";
import { api } from "../lib/apiClient.js";
import { getClientRow } from "../lib/db.js";
import { buildContext } from "./context.js";
import { kbDoc } from "../kb-cache.js";
import { type JobHandler, type HandlerResult, paramString } from "../lib/types.js";

const DEFAULT_SCHEMA_TYPES: Record<string, string> = {
  home_services: "LocalBusiness, Service, CleaningService",
  dental_health: "LocalBusiness, Dentist, MedicalBusiness",
  legal: "LocalBusiness, LegalService, Attorney",
  other: "LocalBusiness, Service",
};

export const generateSchema: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const client = await getClientRow(payload.clientId);
  const vertical = client?.siteType ?? "home_services";
  const ctx = await buildContext(payload.clientSlug, vertical);

  const slug = paramString(payload.params, "slug");
  const pageType = paramString(payload.params, "pageType", "service");
  const pageContent = paramString(payload.params, "pageContent");
  const schemaTypes = paramString(payload.params, "schemaTypes") || DEFAULT_SCHEMA_TYPES[vertical] || "LocalBusiness, Service";
  if (!slug || !pageContent) {
    return { outputFiles: [], log: ["slug and pageContent are required"], status: "failed", errorMessage: "slug + pageContent required" };
  }

  const prompt = renderPrompt("generate-schema", {
    client_facts: ctx.clientFacts,
    vertical_config: ctx.verticalConfig,
    schema_rules: kbDoc("LLS-Website-Complete-Specification.md") || "Use only confirmed facts. Exclude any [VERIFY]-flagged content from structured data.",
    page_type: pageType,
    page_content: pageContent,
    schema_types: schemaTypes,
  });

  // JSON-LD for legal pages (LegalService + Attorney + multi-city areaServed) runs
  // long; 1500 tokens truncated most outputs into invalid JSON. Give it headroom.
  const raw = await callClaude(prompt, { budget: "standard", maxTokens: 4000 });
  let schema: unknown;
  try {
    schema = parseJsonOutput(raw);
  } catch {
    return { outputFiles: [], log: [...log, "Claude did not return valid JSON-LD"], status: "failed", errorMessage: "Invalid JSON-LD output" };
  }

  const path = `schema/${slug}.json`;
  await api.writeFile(payload.clientSlug, path, JSON.stringify(schema, null, 2), "application/ld+json");
  await api.markSchemaGenerated(payload.clientSlug, slug).catch(() => undefined);

  return { outputFiles: [path], log };
};
