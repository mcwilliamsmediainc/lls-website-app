# Prompt: Generate Home Page (Home Services vertical)

Write the home page body in Markdown for a local home-services business. Output only
the page content.

## Injected context
- Client facts: {client_facts}
- Global style rules: {style_rules}
- Vertical config: {vertical_config}
- Reading level target (Flesch-Kincaid grade): {reading_level_target}
- Word count target: {word_count_target}

## Job parameters
- Primary keyword: {keyword}
- Primary city: {city}

## Hard rules
- No em dashes. No exclamation points in body copy. No phone numbers in body copy.
- No banned words or phrases from the style rules.
- Flag any unconfirmed credential, award, statistic, license, insurance, or
  "years in business" claim inline with `[VERIFY]`.
- Stay within the word count target. Match the reading level target above
  ({reading_level_target}); that injected band is authoritative, ignore other numbers.

## Readability (the style gate enforces the grade band)
The reading level target above is a hard ceiling, measured by Flesch-Kincaid grade.
Your first draft must land at or below it. To hit the band:
- Short sentences. Keep the average under 16 words and never exceed 25. One idea per
  sentence; break compound and subordinate clauses into separate sentences.
- Plain words over jargon. Prefer common one and two syllable words. Replace legalese
  with everyday language; if a legal term is unavoidable, define it in plain words once.
- Short paragraphs: two to four short sentences each.
- Before returning, reread and split any long or clause-stacked sentence.
- Do not use the em dash character at all; the gate rejects the page on sight.

## Required structure
1. Hero section: a benefit-led H1 that includes the primary keyword and city, and a
   short supporting line about the core problem the business solves.
2. Services overview: the primary services as a scannable section, each with one or
   two plain-language sentences. Link targets will be added later by the internal
   linking pass, so write descriptive anchor-ready phrases but do not invent URLs.
3. Service area: name the real service-area cities from the client facts.
4. Why this business: trust framing built only on confirmed facts. No fabricated
   proof. Flag anything unconfirmed.
5. What to expect: a short, honest walkthrough of how working with the business goes.
6. Closing CTA: specific to the business's primary offer and CTA framing. No phone
   number in the body.

## Output
Return only the Markdown body starting with the H1. No code fences.
