/**
 * redirect-map — map old URLs (from url-inventory.csv) to new LLS slugs.
 *
 * Deterministic matching first (path heuristics against the generated page slugs),
 * then Claude resolves only the leftover ambiguous URLs. Writes redirect-map.csv.
 */

import { renderPrompt } from "../lib/prompts.js";
import { callClaude, parseJsonOutput } from "../lib/anthropic.js";
import { api } from "../lib/apiClient.js";
import { type JobHandler, type HandlerResult, paramString } from "../lib/types.js";

interface InventoryRow {
  url: string;
  pageType: string;
}

function parseInventoryCsv(csv: string): InventoryRow[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const rows: InventoryRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split('","').map((c) => c.replace(/^"|"$/g, ""));
    if (cols[0]) rows.push({ url: cols[0], pageType: cols[1] ?? "unknown" });
  }
  return rows;
}

function path(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

export const redirectMap: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];

  // Old URLs from inventory.
  let inventoryCsv = paramString(payload.params, "inventoryCsv");
  if (!inventoryCsv) {
    // No inventory in params: read workspace/<slug>/url-inventory.csv from MinIO via the API.
    try {
      const res = await api.getInventory(payload.clientSlug);
      inventoryCsv = res.inventoryCsv ?? "";
      log.push(
        inventoryCsv
          ? "Loaded url-inventory.csv from workspace"
          : "url-inventory.csv missing or empty in workspace"
      );
    } catch (err) {
      log.push(`Failed to load url-inventory.csv from workspace: ${(err as Error).message}`);
    }
  }
  const oldRows = inventoryCsv ? parseInventoryCsv(inventoryCsv) : [];

  // New slugs from generated pages.
  const pages = await api.getPages(payload.clientSlug);
  const newSlugs = pages.map((p) => p.slug);

  const mapped: Array<{ from: string; to: string }> = [];
  const ambiguous: InventoryRow[] = [];

  for (const row of oldRows) {
    const p = path(row.url);
    if (p === "/" && newSlugs.includes("home")) {
      mapped.push({ from: p, to: "/" });
      continue;
    }
    const last = p.split("/").filter(Boolean).pop() ?? "";
    const direct = newSlugs.find((s) => s === last || s.endsWith(`-${last}`) || last.includes(s));
    if (direct) {
      mapped.push({ from: p, to: `/${direct === "home" ? "" : direct}` });
    } else {
      ambiguous.push(row);
    }
  }

  // Resolve ambiguous URLs with Claude (only if any remain).
  if (ambiguous.length && newSlugs.length) {
    const prompt = `Map each OLD path to the best matching NEW slug. If none fits, map to "/" (home).
NEW slugs: ${newSlugs.join(", ")}
OLD paths: ${ambiguous.map((a) => path(a.url)).join(", ")}
Return only JSON: { "oldPath": "newSlugOrEmptyForHome", ... }. No prose, no code fences.`;
    try {
      const raw = await callClaude(prompt, { budget: "standard", maxTokens: 1500 });
      const resolved = parseJsonOutput<Record<string, string>>(raw);
      for (const [from, to] of Object.entries(resolved)) {
        mapped.push({ from, to: to ? `/${to}` : "/" });
      }
    } catch {
      for (const a of ambiguous) mapped.push({ from: path(a.url), to: "/" });
      log.push("Claude resolution failed; defaulted ambiguous URLs to home");
    }
  }

  const csv = ["old_url,new_url,type", ...mapped.map((m) => `"${m.from}","${m.to}","301"`)].join("\n");
  await api.writeFile(payload.clientSlug, "redirect-map.csv", csv, "text/csv");
  await api.completeChecklistItem(payload.clientSlug, "Redirect map generated").catch(() => undefined);

  log.push(`Mapped ${mapped.length} redirects`);
  return { outputFiles: ["redirect-map.csv"], log };
};
