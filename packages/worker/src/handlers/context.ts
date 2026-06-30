/**
 * Shared helpers for building job context: client facts, KB-sourced style rules,
 * and vertical config, plus the staleness handling for the KB cache.
 */

import { api } from "../lib/apiClient.js";
import { getKbContext, kbDoc, type KbContext } from "../kb-cache.js";

export interface JobContext {
  clientFacts: string;
  styleRules: string;
  verticalConfig: string;
  kb: KbContext;
  /** Layout reference extracted from the approved mockup (generate_page only). */
  mockupReference: string;
}

export interface BuildContextOptions {
  /** Fetch the approved mockup as a layout reference (generate_page). */
  includeMockup?: boolean;
}

const NO_MOCKUP = "No design mockup is on file for this client. Use the standard page structure from the vertical config.";

const STYLE_RULES_FALLBACK = `Global Style Rules (fallback summary):
- No em dashes. No exclamation points in body copy.
- Banned words include: utilize, leverage, seamless, world-class, passionate,
  dedicated, comprehensive, robust, curated, empower, streamline, and similar filler.
- Reading level by vertical: commercial pages grade 9-10, residential grade 6-7.
- Flag every unconfirmed credential, award, statistic, license, or before/after claim
  with an inline [VERIFY]. [VERIFY] content is excluded from schema.
- Location pages must pass the city-swap test: 3+ facts true only of the city.
- CTAs must be specific, never generic. No phone numbers in body copy.`;

function verticalConfigFallback(vertical: string): string {
  return `Vertical config (fallback) for ${vertical}:
- Schema types: LocalBusiness, Service${vertical === "home_services" ? ", CleaningService" : ""}.
- Trust signals must be confirmed facts only.
- CTA formula: lead with the outcome and the next step, no phone number in body.`;
}

/**
 * Builds the full context for a content/intake job. Reads client-facts via the API
 * and pulls Global Style Rules + vertical config from the KB cache. Applies the
 * KB staleness policy (throws KbStaleError when cache is >24h and Drive is down).
 */
export async function buildContext(
  clientSlug: string,
  vertical: string,
  opts: BuildContextOptions = {}
): Promise<JobContext> {
  const kb = getKbContext(); // may throw KbStaleError -> caller holds the job
  const facts = await api.getClientFacts(clientSlug);
  const styleRules = kbDoc("L40-Global-Style-Rules.md") || STYLE_RULES_FALLBACK;
  const verticalDoc = kbDoc(`${vertical.replace(/_/g, "-")}-config.md`) || verticalConfigFallback(vertical);

  let mockupReference = NO_MOCKUP;
  if (opts.includeMockup) {
    try {
      const m = await api.getMockup(clientSlug);
      if (m.hasMockup && m.content) {
        mockupReference = m.isText
          ? `Approved design mockup (match this layout: section order, content hierarchy, and component structure):\n${m.content}`
          : m.content;
      }
    } catch {
      // Mockup is a layout aid, not a hard input; fall back to the standard structure.
      mockupReference = NO_MOCKUP;
    }
  }

  return {
    clientFacts: facts.clientFacts || "[client-facts.md is empty]",
    styleRules,
    verticalConfig: verticalDoc,
    kb,
    mockupReference,
  };
}
