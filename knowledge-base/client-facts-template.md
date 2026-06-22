# client-facts.md — Template

The three-tier onboarding template. Every new client build starts from this file.
Copy it to clients/<slug>/client-facts.md (or the workspace) and fill it in.

- **Tier 1** is auto-harvested (GBP Business Information + a scrape of the existing
  site) and then client-confirmed on the confirmation screen. This is the majority
  of the file.
- **Tier 2** is auto-derived (the system's best guess) and flagged for confirmation.
- **Tier 3** is the private Brain Injection, collected via the onboarding form
  (/onboarding/<token>) and reviewed by the team before content generation begins.

Discipline: anything not confirmed by a job or the client is marked `[VERIFY]`
(unconfirmed claim) or `[PENDING]` (awaiting input). Tier 3 answers feed Iris memory
at confidence 1.0 once reviewed.

Replace every `<...>` placeholder. Do not delete the tier headings.

---

## Tier 1 — Harvested, client confirms

- **Business name:** <business name>
- **Primary vertical:** <home_services | dental_health | legal | other>
- **Sub-verticals:** <e.g. carpet cleaning, water/fire restoration>
- **Location (city, state):** <city, state>
- **NAP — address:** <street, city, state, zip>  [VERIFY]
- **NAP — phone:** <primary phone>  [VERIFY]
- **NAP — email:** <contact email>  [VERIFY]
- **Hours:** <hours of operation>  [VERIFY]
- **GBP primary category:** <category>
- **GBP additional categories:** <categories>
- **Service list:** <every distinct service offered>
- **Service areas (cities):** <comma-separated list of cities>
- **Years in business:** <years>  [VERIFY unless in harvested Tier 1]
- **Public reviews:** <rating and count from GBP>  [VERIFY]
- **Existing photos:** <inventory from GBP + site>  [VERIFY]
- **Existing site URL:** <url>
- **Schema markup present on current site:** <types detected>

## Tier 2 — Derived, flagged for confirmation

- **Primary vs secondary services (derived):** <guess>  [VERIFY with client]
- **Commercial / residential split (derived):** <guess>  [VERIFY with client]
- **Ideal-customer profile (derived from review language):** <guess>  [VERIFY with client]
- **Per-city area facts:** [PENDING] populate via geo_research, one section per
  service-area city (geo/<city>.json). Required before location pages are generated.

## Tier 3 — Brain Injection (client-only, via onboarding form)

- **What your best customers say about you (the words they use):** [PENDING — awaiting client submission]
- **What you are most proud of that customers never see:** [PENDING — awaiting client submission]
- **Your best customer story:** [PENDING — awaiting client submission]
- **What makes you genuinely different from your top competitor:** [PENDING — awaiting client submission]
- **What you wish customers knew before they called you:** [PENDING — awaiting client submission]
- **Additional notes:** [PENDING — awaiting client submission]

---

## Build configuration

- **Staging URL:** <slug>.staging.locallaunchsystem.com
- **Phase:** 1
- **Reading level targets:** <per vertical config; e.g. commercial 9-10, residential 6-7>
- **Primary CTA:** <e.g. call or text for a free estimate — rendered by theme, no phone in body>
- **Schema types:** <from vertical config; e.g. LocalBusiness, Service, CleaningService>

## Page plan (Phase 1)

- Home, About, Contact
- Service pages: <one per primary service>
- Location pages: <one per service-area city>
  - Each must pass the city-swap test (3+ facts true only of that city) or publish
    with honest coverage framing plus a [VERIFY] for missing local facts.

## Discipline reminders

- Honest coverage framing only. No fabricated jobs, credentials, awards, or before/after claims.
- Every unconfirmed credential, award, statistic, license, insurance, or year-count claim
  carries a [VERIFY] flag and is excluded from schema until resolved.
- Style gate is a hard block: no em dashes, no exclamation points in body copy, no
  banned words, word count within band, reading level on target.
