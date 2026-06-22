# L40-22 — Image Standard

The authoritative image hierarchy for every LLS build. Injected into every
generate_page and wireframe_generate job and inherited by each vertical config. This
standard replaces the old "no stock" rule with the no-deception principle.

> The test is not "is it stock?" It is: **does this image imply something untrue about
> this business?** A real-looking image of work this business did not do is a
> violation regardless of source. A clearly illustrative image that implies nothing
> false is fine even if it is AI or stock.

---

## The four-tier hierarchy

Use the highest available tier for each zone. Move down a tier only to fill a gap the
tier above cannot cover.

### Tier 1 — Client photos (always first)
Real photos of this business: actual jobs, the team, trucks and equipment, the
facility, real before/after work. Uploaded by Elise at intake or auto-imported from
the client. Always preferred. Never substituted without team review.

### Tier 2 — GBP photos
Auto-imported from the client's Google Business Profile during the GBP verify step.
Often contains real job photos that are not on the client's existing site. Treated as
real client work (because it is). Fills gaps Tier 1 does not cover.

### Tier 3 — AI generated
Produced by the swappable provider system: Gemini Imagen, Stable Diffusion via
Replicate, or DALL-E 3 (global default in Settings, per-client override, automatic
fallback). Always tagged as AI-generated in the photo manager. Use for atmospheric
heroes and illustrative zones only. Never presented as real client work.

### Tier 4 — Manual licensed stock
Sourced by the team only if gaps remain after Tiers 1 through 3. Placed in
`/images/licensed/`. There is no automated stock API — stock is manual-only. Use for
photorealistic zones where AI output looks synthetic (people, close-up service shots,
medical/legal/dental contexts). License ID and terms are stored per image.

## The no-deception principle (governs everything)

Apply this test to every image, in every zone, regardless of tier:

> Does this image imply something untrue about this business?

- **Allowed:** An AI-generated or stock image of a carpet cleaning technician at work
  on a generic service page. It illustrates the service. It does not claim to be a
  specific job this business performed.
- **Not allowed:** An AI-generated or stock image presented as a specific job this
  business completed, a real before/after for this client, a named team member, a real
  customer, or a credential/award the business does not hold.

If an image would make a reasonable visitor believe something false about the
business, it fails, even if it is technically "real" stock. If it implies nothing
false, it passes, even if it is AI.

## Proof zones — real client photos only, no exceptions

Proof page zones (before/after, completed jobs, real results, named team members,
real customers) are **Tier 1 client photos only**. No AI. No stock. No placeholder.

- If a real client photo is not available for a proof zone, the zone stays empty and
  is flagged in the photo manager. An empty proof zone is acceptable; a deceptive one
  is not.
- This is a hard line. It is not overridable by provider settings or by a content
  deadline.

## Zone guidance by type

| Zone type             | Allowed sources                                   |
| --------------------- | ------------------------------------------------- |
| Hero / atmospheric    | Client > GBP > AI > stock                         |
| Service illustration  | Client > GBP > AI > stock (no implied specific job)|
| Before / after        | Client photos only                                |
| Completed job / proof | Client photos only                                |
| Team / staff          | Client photos only (real people)                  |
| Customer / testimonial| Client photos only (real people, with consent)    |
| Facility / equipment  | Client > GBP, then AI/stock only if generic       |
| Awards / credentials  | Real artifacts only, and only if [VERIFY] cleared |

## Interaction with the style gate and schema

- An image that fails the no-deception test is a build blocker for that zone, the same
  way a banned word blocks text.
- Any award, certification, or credential depicted in an image must be confirmed in
  client-facts.md (no [VERIFY] outstanding) before it is used, and is excluded from
  schema until verified.
- Alt text is generated per image and must describe the image honestly. Alt text must
  not assert a specific job, result, or credential that the image does not truthfully
  represent.
