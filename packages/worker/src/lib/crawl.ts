/**
 * Lightweight same-domain crawler used by site_scrape and url_inventory.
 * Fetches HTML, extracts links within the same host, and returns page text.
 * Bounded by a max page count to keep jobs fast and polite.
 */

import * as cheerio from "cheerio";

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  links: string[];
}

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

function normalize(base: string, href: string): string | null {
  try {
    const u = new URL(href, base);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export async function crawlSite(startUrl: string, maxPages = 40): Promise<CrawledPage[]> {
  const seen = new Set<string>();
  const queue: string[] = [startUrl];
  const pages: CrawledPage[] = [];

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    let html: string;
    try {
      const res = await fetch(url, { headers: { "user-agent": "LLS-BuildBot/1.0" }, redirect: "follow" });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) continue;
      html = await res.text();
    } catch {
      continue;
    }

    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    const title = $("title").first().text().trim();
    const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);

    const links: string[] = [];
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const abs = normalize(url, href);
      if (abs && sameHost(abs, startUrl)) {
        links.push(abs);
        if (!seen.has(abs) && queue.length + pages.length < maxPages) queue.push(abs);
      }
    });

    pages.push({ url, title, text, links: Array.from(new Set(links)) });
  }

  return pages;
}
