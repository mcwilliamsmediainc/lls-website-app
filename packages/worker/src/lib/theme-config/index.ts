/**
 * config.php generator for the lls-local-40 master theme.
 *
 * Produces a client's theme config by overlaying live data onto the vertical
 * base template, replacing the hand-written per-client config.php:
 *   - business_name / phone / email / address / hours  <- client-facts.md Tier 1
 *   - vertical                                          <- client.site_type (facts fallback)
 *   - locations                                         <- client-facts.md service areas
 *   - color_primary/accent/sky + palette                <- approved mockup
 *   - attorney (bio)                                    <- Brain Injection (legal only)
 *   - img_hero/attorney/office/lobby/team               <- photos (category + page_assigned)
 * Anything the data pipeline does not yet cover stays at the vertical base value.
 *
 * `assembleThemeConfig` is pure (unit-testable); `generateThemeConfigForClient`
 * wires it to the DB + workspace.
 */

import { verticalBase, type ThemeConfig } from "./base.js";
import { parseClientFacts, type ParsedFacts } from "./facts.js";
import { extractMockupColors } from "./colors.js";
import { renderConfigPhp } from "./render.js";

export { parseClientFacts, extractMockupColors, renderConfigPhp };

export interface AssignedPhoto {
  id: number;
  filename: string;
  category: string | null;
  zoneType: string | null;
  pageAssigned: string | null;
  altText: string | null;
  generationMetadata?: Record<string, unknown> | null;
}

export interface BrainInjection {
  status: string;
  proudOf?: string | null;
  differentiator?: string | null;
  additionalNotes?: string | null;
}

export interface AssembleInputs {
  businessName?: string;
  siteType: string;
  factsMd?: string;
  mockup?: { approved: boolean; content: string } | null;
  brain?: BrainInjection | null;
  photos?: AssignedPhoto[];
}

export interface AssembleResult {
  config: ThemeConfig;
  /** Fields taken from live data (for the deploy log). */
  sourced: string[];
  /** Fields that stayed at the base value because live data was absent. */
  fellBack: string[];
  /** Tier 1 fields that still carried a [VERIFY]/[PENDING] flag. */
  unverified: string[];
}

/** Theme image zone -> photo category it is filled from. */
const IMAGE_ZONES: Array<{ key: string; category: string }> = [
  { key: "img_hero", category: "hero" },
  { key: "img_attorney", category: "team" },
  { key: "img_office", category: "office" },
  { key: "img_lobby", category: "office" },
  { key: "img_team", category: "team" },
];

/** Resolve the WordPress attachment id for a photo, if one was recorded. */
function attachmentId(p: AssignedPhoto): number | null {
  const meta = p.generationMetadata ?? {};
  for (const k of ["wp_attachment_id", "attachment_id", "wpAttachmentId"]) {
    const v = meta[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  }
  return null;
}

export function assembleThemeConfig(inputs: AssembleInputs): AssembleResult {
  const facts: ParsedFacts = parseClientFacts(inputs.factsMd ?? "");
  // Vertical: prefer the confirmed site_type; fall back to the facts value.
  const vertical = inputs.siteType || facts.vertical || "home_services";
  const config = verticalBase(vertical);
  const sourced: string[] = [];
  const fellBack: string[] = [];

  const set = (key: string, value: unknown) => {
    config[key] = value as ThemeConfig[string];
    if (!sourced.includes(key)) sourced.push(key);
  };

  config.vertical = vertical;
  sourced.push("vertical");

  // Business identity + NAP from Tier 1.
  const name = inputs.businessName || facts.businessName;
  if (name) {
    set("business_name", name);
    config.logo_text = name;
    config.logo_letter = name.trim().charAt(0).toUpperCase();
  } else fellBack.push("business_name");

  if (facts.phone) set("phone", facts.phone);
  else fellBack.push("phone");

  if (facts.email) set("email", facts.email);
  else fellBack.push("email");

  if (facts.address) {
    set("address", facts.address.full);
    set("map_query", facts.address.full);
    set("address_parts", {
      street: facts.address.street,
      city: facts.address.city,
      state: facts.address.state,
      zip: facts.address.zip,
    });
  } else fellBack.push("address");

  if (facts.hoursShort) set("hours_short", facts.hoursShort);
  else fellBack.push("hours_short");

  if (facts.locations && Object.keys(facts.locations).length) set("locations", facts.locations);
  else fellBack.push("locations");

  if (facts.region) config.region = facts.region;

  // Colors from the approved mockup only.
  const colors = inputs.mockup?.approved ? extractMockupColors(inputs.mockup.content) : null;
  if (colors) {
    if (colors.primary) set("color_primary", colors.primary);
    if (colors.accent) set("color_accent", colors.accent);
    if (colors.sky) set("color_sky", colors.sky);
    if (colors.palette && Object.keys(colors.palette).length) {
      set("palette", { ...(config.palette as Record<string, string>), ...colors.palette });
    }
  } else fellBack.push("colors");

  // Attorney bio enrichment from a reviewed Brain Injection (legal only). The
  // Brain Injection has no structured name field, so the name/title stay at the
  // base value; only the narrative bio is enriched when reviewed content exists.
  if (vertical === "legal") {
    const b = inputs.brain;
    const bioText = b && b.status === "reviewed" ? (b.differentiator || b.proudOf || "").trim() : "";
    if (bioText) {
      const attorney = { ...(config.attorney as Record<string, unknown>) };
      attorney.bio = bioText;
      set("attorney", attorney);
    } else fellBack.push("attorney");
  }

  // Image zones from assigned photos (category match + page_assigned set).
  const assigned = (inputs.photos ?? []).filter((p) => p.pageAssigned);
  for (const zone of IMAGE_ZONES) {
    const match = assigned.find((p) => p.category === zone.category);
    const id = match ? attachmentId(match) : null;
    if (id !== null) set(zone.key, id);
    else fellBack.push(zone.key);
  }

  return { config, sourced, fellBack, unverified: facts.unverified };
}

/** Header comment written into the generated config.php. */
export function configHeader(slug: string, sourced: string[]): string {
  return [
    `lls-local-40 client config for ${slug} — GENERATED by the config.php generator.`,
    `Do not edit by hand; regenerate from client-facts.md, the approved mockup, and the photos table.`,
    `Live-sourced fields: ${sourced.join(", ")}.`,
  ].join("\n");
}
