# Vertical Config — Other (configurable)

Fallback vertical config for clients that do not fit home services, dental/health, or
legal. Populated from Elise's six intake questions at client creation. Inherits the
Global Style Rules.

> Until the six intake answers are captured, treat unknowns as [VERIFY] rather than
> guessing. This config is intentionally generic and should be tightened per client.

---

## Elise's six intake questions (populate this config)

1. What does the business do, in one plain sentence?
2. Who is the primary customer (residential, commercial, both)?
3. What are the primary services or offerings (in priority order)?
4. What are the service-area cities?
5. What is the primary action you want a visitor to take (call, book, request quote, buy)?
6. What proof or trust signals are genuinely confirmed (licenses, years, guarantees, results)?

## Schema types

- **Primary:** LocalBusiness
- **Service** for each service / offering page
- `areaServed` from confirmed service-area cities
- Add a more specific schema.org type only if it clearly fits and is confirmed.
- No ratings, awards, or credentials in schema unless confirmed. [VERIFY] content
  is excluded from structured data.

## Reading level targets (Flesch-Kincaid grade)

- Default residential/consumer pages: grade 6-8
- Business / technical pages: grade 9-10
- Set the band from intake answer #2 and calibrate per page tree.

## Page taxonomy

- Home
- Services / offerings hub
- One page per primary service/offering
- One location page per service-area city
- About
- Contact
- FAQ (optional)

## Trust signals

- Use only what intake answer #6 confirms. Everything else carries [VERIFY].

## CTA formulas

- Built from intake answer #5. Make it specific to the offering and the next step.
- No phone numbers in body copy.

## Location page rules (city-swap test)

- 3+ genuine local facts per city. Honest coverage framing if facts are thin. Never
  fabricate.

## Image defaults (L40-22 hierarchy)

1. Client photos — always first
2. GBP photos
3. AI generation — atmospheric/illustrative only, tagged AI
4. Licensed stock — photorealistic zones where AI looks synthetic

Proof zones are real-only. Set stock/AI search defaults from the intake answers at
client creation.
