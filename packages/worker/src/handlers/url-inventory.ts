/**
 * url-inventory — crawl the existing site and write a clean URL inventory CSV.
 * Standalone counterpart to the inventory produced inside site-scrape; useful when
 * re-running just the URL map (e.g. before generating the redirect map).
 */

import { api } from "../lib/apiClient.js";
import { crawlSite } from "../lib/crawl.js";
import { getClientRow } from "../lib/db.js";
import { type JobHandler, type HandlerResult, paramString } from "../lib/types.js";

function guessType(url: string): string {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();
  if (path === "/" || path === "") return "home";
  if (path.includes("contact")) return "contact";
  if (path.includes("about")) return "about";
  if (path.includes("blog") || path.includes("news")) return "blog";
  if (path.includes("location") || path.includes("areas") || path.includes("service-area")) return "location";
  if (path.includes("service")) return "service";
  return "other";
}

export const urlInventory: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const client = await getClientRow(payload.clientId);
  const startUrl = paramString(payload.params, "siteUrl") || client?.siteUrl || "";
  if (!startUrl) {
    return { outputFiles: [], log: ["No site URL on the client record"], status: "failed", errorMessage: "No site URL" };
  }

  const pages = await crawlSite(startUrl, 60);
  log.push(`Crawled ${pages.length} pages`);
  const rows = ["url,page_type,title"];
  for (const p of pages) {
    rows.push(`"${p.url}","${guessType(p.url)}","${p.title.replace(/"/g, "'")}"`);
  }
  await api.writeFile(payload.clientSlug, "url-inventory.csv", rows.join("\n"), "text/csv");
  return { outputFiles: ["url-inventory.csv"], log };
};
