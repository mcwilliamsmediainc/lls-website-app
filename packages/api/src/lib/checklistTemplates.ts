/**
 * Auto-created checklist items per pipeline stage (kickoff prompt Section 11).
 * Items are created when a client enters a stage. Some are dynamic (one per
 * service area city / one per primary service) and are expanded at creation time.
 */

import type { ClientStage } from "./db.js";

export interface ChecklistTemplateItem {
  itemName: string;
  /** Suggested default owner role label, free text (not enforced). */
  assigneeHint?: string;
}

export const STAGE_CHECKLISTS: Record<ClientStage, ChecklistTemplateItem[]> = {
  intake: [
    { itemName: "site_scrape job complete" },
    { itemName: "gbp_verify job complete" },
    { itemName: "geo_research job complete (one per service area city)" },
    { itemName: "gap_report job complete" },
    { itemName: "client-facts.md reviewed by Elise", assigneeHint: "elise" },
    { itemName: "Brain Injection submitted by client" },
    { itemName: "Brain Injection reviewed by team" },
    { itemName: "Intake approved — move to Content" },
  ],
  content: [
    { itemName: "Home page generated" },
    { itemName: "About page generated" },
    { itemName: "Service pages generated (one per primary service)" },
    { itemName: "Location pages generated (one per service area city)" },
    { itemName: "Contact page generated" },
    { itemName: "Schema generated for all pages" },
    { itemName: "All [VERIFY] flags resolved" },
    { itemName: "Style gate passing on all pages" },
    { itemName: "Internal linking pass complete (only after all pages approved)" },
    { itemName: "Redirect map generated" },
    { itemName: "Content approved — move to Review" },
  ],
  review: [
    { itemName: "Staging site deployed" },
    { itemName: "QA review by Clarence", assigneeHint: "clarence" },
    { itemName: "Final approval by Matt", assigneeHint: "matt" },
    { itemName: "Review approved — move to Live" },
  ],
  live: [
    { itemName: "Push to live executed" },
    { itemName: "Live site verified" },
    { itemName: "Client notified" },
  ],
};

/** Expand a city-scoped or service-scoped item into one per provided value. */
export function expandDynamicItems(
  baseItems: ChecklistTemplateItem[],
  opts: { cities?: string[]; services?: string[] }
): ChecklistTemplateItem[] {
  const out: ChecklistTemplateItem[] = [];
  for (const item of baseItems) {
    if (opts.cities?.length && item.itemName.includes("one per service area city")) {
      for (const city of opts.cities) {
        out.push({ ...item, itemName: item.itemName.replace(/\(one per service area city\)/, `(${city})`) });
      }
      continue;
    }
    if (opts.services?.length && item.itemName.includes("one per primary service")) {
      for (const svc of opts.services) {
        out.push({ ...item, itemName: item.itemName.replace(/\(one per primary service\)/, `(${svc})`) });
      }
      continue;
    }
    out.push(item);
  }
  return out;
}
