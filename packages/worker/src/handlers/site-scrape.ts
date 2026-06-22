/**
 * site-scrape — crawl the client's existing site and extract Tier 1 facts.
 *
 * Crawls same-domain pages, asks Claude to extract structured facts (NAP, services,
 * service areas, schema present, page inventory), writes url-inventory.csv and a
 * site-scrape.json to the workspace, and marks the intake checklist item.
 */

import { renderPrompt } from "../lib/prompts.js";
import { callClaude, parseJsonOutput } from "../lib/anthropic.js";
import { api } from "../lib/apiClient.js";
import { crawlSite } from "../lib/crawl.js";
import { getClientRow } from "../lib/db.js";
import { buildContext } from "./context.js";
import { type JobHandler, type HandlerResult, paramString } from "../lib/types.js";

interface Extraction {
  page_inventory?: Array<{ url: string; page_type: string; title: string }>;
  [k: string]: unknown;
}

export const siteScrape: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const client = await getClientRow(payload.clientId);
  const startUrl = paramString(payload.params, "siteUrl") || client?.siteUrl || "";
  if (!startUrl) {
    return { outputFiles: [], log: ["No site URL on the client record"], status: "failed", errorMessage: "No site URL to scrape" };
  }

  log.push(`Crawling ${startUrl}`);
  const pages = await crawlSite(startUrl, 40);
  log.push(`Crawled ${pages.length} pages`);
  if (!pages.length) {
    return { outputFiles: [], log, status: "failed", errorMessage: "Crawl returned no pages" };
  }

  const ctx = await buildContext(payload.clientSlug, client?.siteType ?? "home_services");
  const crawlText = pages
    .map((p) => `URL: ${p.url}\nTITLE: ${p.title}\nTEXT: ${p.text.slice(0, 2000)}`)
    .join("\n\n---\n\n");

  const prompt = renderPrompt("site-scrape", {
    client_facts: ctx.clientFacts,
    crawled_pages: crawlText,
  });

  log.push("Extracting structured facts with Claude");
  const raw = await callClaude(prompt, { budget: "page" });
  let extraction: Extraction;
  try {
    extraction = parseJsonOutput<Extraction>(raw);
  } catch {
    extraction = { raw_text: raw };
  }

  // Write url-inventory.csv from the crawl (deterministic) + the page_type from extraction if present.
  const typeByUrl = new Map<string, string>();
  for (const e of extraction.page_inventory ?? []) typeByUrl.set(e.url, e.page_type);
  const csvRows = ["url,page_type,title"];
  for (const p of pages) {
    const pt = typeByUrl.get(p.url) ?? "unknown";
    csvRows.push(`"${p.url}","${pt}","${p.title.replace(/"/g, "'")}"`);
  }
  await api.writeFile(payload.clientSlug, "url-inventory.csv", csvRows.join("\n"), "text/csv");
  await api.writeFile(payload.clientSlug, "site-scrape.json", JSON.stringify(extraction, null, 2), "application/json");

  await api.completeChecklistItem(payload.clientSlug, "site_scrape job complete").catch(() => undefined);

  return { outputFiles: ["url-inventory.csv", "site-scrape.json"], log };
};
