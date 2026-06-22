# Vertical Config — Home Services

Injected into every generate_page, generate_schema, gap_report, and wireframe job
for home-services clients. Inherits the Global Style Rules. This file defines the
schema types, trust signals, reading levels, CTA formulas, and image defaults that
are specific to the home-services vertical.

First reference build: Tulsa Kwik Dry Total Cleaning (carpet cleaning + water/fire
restoration), a dual sub-vertical client.

---

## Schema types

- **Primary:** LocalBusiness
- **Service** for each service page
- **CleaningService** where the service is cleaning (carpet, tile, upholstery)
- Use `areaServed` populated from the confirmed service-area cities
- Do NOT emit aggregateRating, review, award, or certification properties unless
  they are confirmed in client-facts.md. Anything carrying a [VERIFY] flag is
  excluded from structured data.

## Reading level targets (Flesch-Kincaid grade)

- **Residential pages:** grade 6-7 (home page, residential service pages, about, contact, location)
- **Commercial pages:** grade 9-10 (commercial restoration, commercial cleaning, B2B service pages)
- Calibrate per page tree, not site-wide. Dual-vertical clients (like Kwik Dry)
  carry both: keep the carpet-cleaning residential tree at 6-7 and the
  restoration/commercial tree at 9-10.

## Page taxonomy

- Home
- Service hub (overview of all services)
- One page per primary service (e.g. Carpet Cleaning, Water Damage Restoration, Fire Damage Restoration)
- One location page per confirmed service-area city
- About
- Contact
- FAQ (optional)
- Proof pages render from real records only (no AI, no stock) — v2 capture UI

## Trust signals (use only when confirmed)

- Years in business (confirmed in client-facts or harvested Tier 1)
- Licensing and insurance (require [VERIFY] unless confirmed)
- Service guarantees the client actually offers
- Real before/after work (proof pages, real photos only)
- Genuine local knowledge (the city-swap facts on location pages)

Never imply 24/7 emergency response, specific response times, certifications,
manufacturer approvals, or job counts unless they are confirmed. Flag with [VERIFY].

## CTA formulas

- Lead with the outcome and the next step. No phone numbers in body copy (the theme
  renders contact details from client-facts).
- Residential carpet/cleaning: "Book a free carpet cleaning estimate" / "See your
  carpets dry and clean by [timeframe the client confirms]".
- Restoration / emergency: focus on fast help and the first step, e.g. "Start your
  water damage cleanup" or "Get restoration help for your home". Avoid promising a
  specific arrival time unless confirmed.
- Every CTA must be service-specific. Never "contact us today" with no specificity.

## Location page rules (city-swap test)

- Each location page must contain 3+ facts true only of that city: neighborhoods,
  housing stock and age, local water/soil/climate conditions, recognizable landmarks.
- Pull these from the geo_research output (geo/<city>.json) gathered at intake.
- If 3 genuine local facts are not available, publish with honest coverage framing
  and a [VERIFY] flag for the missing local facts. Never fabricate local detail.
- Job photos are preferred on location pages but NOT required (site 1 lesson): real
  area knowledge plus honest coverage framing is sufficient.

## Image defaults (L40-22 hierarchy)

1. Client photos (always first) — real job photos, before/after, team, trucks
2. GBP photos — fills gaps the client photos do not cover
3. AI generation — atmospheric heroes and illustrative zones only, tagged AI
4. Licensed stock (123RF) — photorealistic zones where AI looks synthetic
   (people, close-up service shots)

Proof zones are real-only: no AI, no stock, no placeholder. The test is not "is it
stock" but "does this image imply something untrue".

Stock/AI search defaults for home services: tools and tradespeople in action,
residential exteriors, clean carpets/tile, water extraction equipment, drying fans,
before/after restoration work.

## Sub-vertical notes

- **Carpet / upholstery / tile cleaning:** residential-leaning, grade 6-7, outcome-led
  CTAs, CleaningService schema.
- **Water / fire / mold restoration:** mixed residential + commercial, grade 9-10 on
  commercial pages, emphasize first steps and honest help framing, Service schema.
  Never fabricate insurance-claim assistance or IICRC-style certifications without
  [VERIFY].
