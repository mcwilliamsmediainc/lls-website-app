# L40 — Global Style Rules

Injected into every content generation job (generate_page, internal_linking,
monthly_refresh) and inherited by every vertical config. These rules are enforced
two ways: as guidance in the generation prompt, and as a programmatic hard gate
(style-gate/rules.json + word-count-targets.json). The machine gate is the source of
truth for pass/fail; this document is the human-readable companion and must stay in
sync with rules.json.

> The style gate is a hard block, not a review step. A failed gate prevents publish
> with no manual override (except the explicit bypass_style_gate permission, which is
> matt + tyler only). It is not a checklist item for Penn or Rachelle.

---

## Hard formatting rules

- **No em dashes** anywhere. Replace with commas, colons, periods, or rewrite.
- **No en dashes** in body copy.
- **No exclamation points** in body copy.
- **No phone numbers** in body copy. Contact details render from client-facts via the theme.
- These are gate failures, including in taglines, headings, meta descriptions, and any
  text that feeds OG tags. A buried em dash in a tagline fails the gate.

## Banned words and phrases

Do not use any of the following (case-insensitive). This list mirrors
style-gate/rules.json:

utilize, leverage, synergy, seamless, cutting-edge, state-of-the-art, world-class,
best-in-class, innovative, passionate, dedicated, committed, comprehensive, holistic,
game-changing, revolutionary, transformative, robust, scalable, tailor-made, bespoke,
curated, empower, streamline, best practices, at the end of the day, moving forward,
it goes without saying, in conclusion, in summary, don't hesitate, feel free to,
rest assured.

Write plainly. Say what the business does and what the customer gets, in concrete terms.

## Reading level (per vertical, per page tree)

- Calibrate to the vertical config, not site-wide.
- Home services: residential grade 6-7, commercial grade 9-10.
- Reading level is a gate parameter. The first draft must land in band, not converge
  through repeated gate failures. Seed the prompt with the reading level and word
  count targets up front.

## Word count bands (per page type)

Mirrors style-gate/word-count-targets.json:

| Page type    | Min | Max  |
| ------------ | --- | ---- |
| home         | 800 | 1400 |
| service      | 700 | 1200 |
| service-hub  | 500 | 900  |
| location     | 600 | 1000 |
| about        | 500 | 900  |
| contact      | 150 | 400  |
| faq          | 400 | 800  |

Out-of-band word count is a gate failure.

## [VERIFY] flags and no-fabrication discipline

- Never fabricate a fact. Flag any unconfirmed claim inline with `[VERIFY]` immediately
  after the claim.
- Claims that always require [VERIFY] unless confirmed in client-facts.md:
  specific credentials or licenses, awards or recognitions, years in business (unless
  in Tier 1 harvested data), service-area claims for a city not in the confirmed list,
  before/after specifics, competitor comparisons (always), statistical claims (need a
  citable source), and city-specific local facts (must be verifiable).
- [VERIFY] flags do not block generation, but they block approval. They are excluded
  from schema so nothing unverified reaches structured data.
- The gate also surfaces sentences that look like they need a [VERIFY] but are unflagged
  (award, certified, licensed, insured, years of experience, rated #1, top rated, best
  in, voted, recognized). Resolve or flag them.

## The city-swap test (highest-value rule)

- A location page must contain 3+ facts true only of its city. If the page would read
  identically with the city name swapped out, it does not publish.
- If 3 genuine local facts are not available, use honest coverage framing and add a
  [VERIFY] for the missing local facts. Never invent local detail.

## CTA standards

- Every CTA is specific to the service and the outcome. No generic "contact us today".
- Hit the primary keyword early (within the first 20 words on a service page).
- Introduce the business name naturally, not in the first sentence.

## Publish gate summary

A page publishes only when: no banned words, no em/en dashes, no exclamation points in
body copy, word count in band, reading level on target, and all [VERIFY] flags resolved.
Gate failure marks the job gate_failed and writes the reason to
content_pages.gate_failure_reason.
