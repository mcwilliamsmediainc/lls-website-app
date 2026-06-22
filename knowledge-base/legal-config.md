# Vertical Config — Legal

Injected into generate_page, generate_schema, gap_report, and wireframe jobs for
legal clients. Inherits the Global Style Rules.

> Legal content must avoid implying outcomes, guarantees, or an attorney-client
> relationship. Never state case results, settlements, or credentials that are not
> confirmed. Flag with [VERIFY]. No before/after content in this vertical.

---

## Schema types

- **Primary:** LocalBusiness with LegalService
- **Attorney** for bio pages
- **Service** for each practice area page
- `areaServed` from confirmed service-area cities
- No aggregateRating, award, or "super lawyer"-type properties unless confirmed.
  [VERIFY] content excluded from schema.

## Reading level targets (Flesch-Kincaid grade)

- **Consumer practice areas** (family, personal injury, estate): grade 7-8
- **Business / complex litigation:** grade 9-11
- Calibrate per page tree.

## Page taxonomy

- Home
- Practice areas hub
- One page per practice area
- Attorney bio pages (one per attorney)
- One location page per service-area city
- About / the firm
- Contact / request consultation
- FAQ

No before/after zones. No client testimonials presented as outcome guarantees.

## Trust signals (use only when confirmed)

- Bar admissions, years practicing, areas of focus (require [VERIFY] unless confirmed)
- Genuine firm history and approach
- Real, consented client testimonials framed as experience, not guaranteed outcomes

Never imply case outcomes, win rates, settlement amounts, or guarantees. Avoid any
language that could create an attorney-client relationship or be read as legal advice.

## CTA formulas

- Consultation-led. "Request a consultation", "Schedule a case review", "Talk to our
  team about your situation". No phone numbers in body copy.
- Avoid urgency, pressure, or outcome promises.

## Location page rules (city-swap test)

- 3+ genuine local facts per city: courts served, neighborhoods, community context,
  local considerations relevant to the practice area.
- Honest coverage framing if local facts are thin. Never fabricate jurisdiction claims.

## Image defaults (L40-22 hierarchy)

1. Client photos (real attorneys, real office) — always first
2. GBP photos
3. AI generation — atmospheric office/cityscape only, never fake people presented as
   attorneys or clients
4. Licensed stock — professional office, consultation, courthouse, attorney-headshot
   style for people-heavy zones

Bio headshots must be the real attorney. Never substitute stock or AI for a named
attorney photo.

Stock/AI defaults: professional office interiors, consultation settings, courthouse
exteriors, city skyline.
