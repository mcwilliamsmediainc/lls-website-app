# Vertical Config — Dental / Health

Injected into generate_page, generate_schema, gap_report, and wireframe jobs for
dental and health clients. Inherits the Global Style Rules.

> Health content carries higher trust and accuracy stakes. Never state clinical
> outcomes, success rates, or credentials that are not confirmed. Flag with [VERIFY].

---

## Schema types

- **Primary:** LocalBusiness with MedicalBusiness / Dentist as appropriate
- **MedicalProcedure** or **Service** for each procedure / service page
- `areaServed` from confirmed service-area cities
- No aggregateRating, award, or board-certification properties unless confirmed
  in client-facts. [VERIFY] content is excluded from schema.

## Reading level targets (Flesch-Kincaid grade)

- **Patient-facing pages:** grade 6-7 (procedures explained plainly, home, about, contact)
- **Clinical / referral pages:** grade 9-10
- Calibrate per page tree.

## Page taxonomy

- Home
- Services / procedures hub
- One page per procedure (e.g. cleanings, implants, orthodontics, cosmetic)
- One location page per service-area city
- About / meet the team
- Contact / book appointment
- FAQ
- New patient information

## Trust signals (use only when confirmed)

- Provider credentials, degrees, board status (require [VERIFY] unless confirmed)
- Years in practice, technology offered, sedation options
- Insurance and financing accepted (confirm specifics)
- Real patient outcomes only, with consent — never invent before/after

Never imply pain-free guarantees, specific success rates, or outcomes. Avoid
diagnostic or treatment claims. Keep to what the practice confirms it offers.

## CTA formulas

- Patient-led and reassuring. "Book your appointment", "Schedule a new patient visit",
  "Request a consultation". No phone numbers in body copy.
- Cosmetic / elective: outcome-led but honest, e.g. "See your options for a brighter smile".
- Avoid urgency or pressure language.

## Location page rules (city-swap test)

- 3+ genuine local facts per city. For health, lean on community context: local
  neighborhoods served, proximity, parking/access, area demographics where relevant.
- Honest coverage framing if local facts are thin. Never fabricate.

## Image defaults (L40-22 hierarchy)

1. Client photos (real office, real team) — always first
2. GBP photos
3. AI generation — atmospheric only, never depicting fake patients or procedures
4. Licensed stock — clinical environment, staff, procedure-adjacent (people-heavy
   zones where AI looks synthetic)

Proof / patient-result zones are real-only with consent. Never present stock or AI
people as real patients or staff.

Stock/AI defaults: clean clinical environments, welcoming reception, professional
staff, modern equipment.
