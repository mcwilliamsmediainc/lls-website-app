# client-facts.md — Tulsa Kwik Dry Total Cleaning

> Three-tier onboarding file. Tier 1 is auto-harvested (GBP + site scrape) and
> client-confirmed. Tier 2 is auto-derived and flagged for confirmation. Tier 3 is
> the private Brain Injection, collected via the onboarding form. Anything not yet
> confirmed by a job or the client is marked [VERIFY] or [PENDING].

---

## Tier 1 — Harvested, client confirms

- **Business name:** Tulsa Kwik Dry Total Cleaning
- **Primary vertical:** Home Services
- **Sub-verticals:** Carpet Cleaning, Water/Fire Restoration
- **Location:** Tulsa, Oklahoma
- **Service areas:** Tulsa, Broken Arrow, Bixby, Jenks, Owasso, Sand Springs, Sapulpa, Claremore
- **GBP categories:** Carpet Cleaning Service, Water Damage Restoration Service
- **Site type:** Home Services
- **NAP — address:** [VERIFY] confirm street address from GBP/site
- **NAP — phone:** [VERIFY] confirm primary phone from GBP/site
- **NAP — email:** [VERIFY] confirm contact email
- **Hours:** [VERIFY] confirm hours from GBP
- **Years in business:** [VERIFY] not yet confirmed
- **Existing reviews:** [VERIFY] pull rating and count from GBP during gbp_verify
- **Existing photos:** [VERIFY] inventory from GBP + site during site_scrape

## Tier 2 — Derived, flagged for confirmation

- **Primary vs secondary services (derived):** Primary — Carpet Cleaning (residential).
  Secondary — Water/Fire Restoration (commercial + residential emergency). [VERIFY] with client.
- **Commercial / residential split (derived):** Residential-leaning for carpet cleaning;
  restoration spans both. [VERIFY] with client.
- **Ideal-customer profile (derived from review language):** [VERIFY] populate after gbp_verify
  surfaces review text.
- **Per-city area facts:** [PENDING] populate via geo_research, one section per service-area city
  (see geo/ outputs). Required before location pages are generated.

## Tier 3 — Brain Injection (client-only, via onboarding form)

- **What your best customers say about you:** [PENDING — awaiting client submission]
- **What you are most proud of that customers never see:** [PENDING — awaiting client submission]
- **Your best customer story:** [PENDING — awaiting client submission]
- **What makes you different from your top competitor:** [PENDING — awaiting client submission]
- **What you wish customers knew before they called:** [PENDING — awaiting client submission]
- **Additional notes:** [PENDING — awaiting client submission]

---

## Build configuration

- **Staging URL:** tulsa-kwik-dry.staging.locallaunchsystem.com
- **Phase:** 1 (content generation only)
- **Reading level targets:** Commercial pages grade 9-10; Residential pages grade 6-7
- **Primary CTA:** Call or text for a free estimate
  - Note: no phone numbers in body copy. CTA framing is rendered by the theme.
- **Schema types:** LocalBusiness, Service, CleaningService

## Page plan (Phase 1)

- Home
- About
- Contact
- Service: Carpet Cleaning
- Service: Water/Fire Restoration
- Location pages: Tulsa, Broken Arrow, Bixby, Jenks, Owasso, Sand Springs, Sapulpa, Claremore
  - Each must pass the city-swap test (3+ facts true only of that city) or publish with
    honest coverage framing and a [VERIFY] for missing local facts.

## Discipline reminders

- Honest coverage framing only. No fabricated jobs, credentials, awards, or before/after claims.
- Every unconfirmed credential, award, statistic, license, insurance, or year-count claim
  carries a [VERIFY] flag and is excluded from schema until resolved.
- Style gate is a hard block: no em dashes, no exclamation points in body copy, no banned words,
  word count within band, reading level on target.
