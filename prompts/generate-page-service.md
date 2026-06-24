# Prompt: Generate Service Page (Home Services vertical)

You are writing one service page for a local home-services business. Write only the
page body in Markdown. Do not include front matter, explanations, or notes outside
the page content.

## Injected context
- Client facts: {client_facts}
- Global style rules: {style_rules}
- Vertical config: {vertical_config}
- Reading level target (Flesch-Kincaid grade): {reading_level_target}
- Word count target: {word_count_target}

## Job parameters
- Service: {service}
- City / location (may be empty): {city}
- Primary keyword: {keyword}

## Hard rules (failing any of these fails the page)
- No em dashes anywhere. Use commas, colons, periods, or rewrite.
- No exclamation points in body copy.
- No phone numbers in body copy.
- Never use any banned word or phrase from the style rules.
- Never fabricate a fact. Any credential, award, statistic, license, insurance,
  "years in business," or before/after specific that is not confirmed in the client
  facts must be written with an inline `[VERIFY]` flag immediately after the claim.
- Stay inside the word count target. Do not exceed the maximum; the first draft must
  land in band, not converge through rewrites.
- Match the reading level target above ({reading_level_target}). That injected band is
  authoritative for this client's vertical; ignore any other grade numbers.

## Readability (the style gate enforces the grade band)
The reading level target above is a hard ceiling, measured by Flesch-Kincaid grade.
Your first draft must land at or below it. To hit the band:
- Short sentences. Keep the average under 16 words and never exceed 25. One idea per
  sentence; break compound and subordinate clauses into separate sentences.
- Plain words over jargon. Prefer common one and two syllable words. Replace legalese
  with everyday language (for example "carelessness" or "fault" instead of
  "negligence"); if a legal term is unavoidable, define it in plain words once.
- Short paragraphs: two to four short sentences each.
- Before returning, reread and split any long or clause-stacked sentence.
- Do not use the em dash character at all; the gate rejects the page on sight.

## Required structure and behavior
1. Open with a hook specific to the service and the city (if a city is provided).
   The hook must be about the reader's problem, not about the company.
2. Hit the primary keyword within the first 20 words.
3. Introduce the business name naturally, but not in the first sentence.
4. If a city is specified, pass the city-swap test: include at least 3 hyper-local
   facts that are true only of this city (neighborhoods, housing stock, climate or
   water conditions, local landmarks relevant to the service). If you cannot supply
   3 genuine local facts from the client facts or vertical config, do not invent
   them: write the page with honest coverage framing instead and flag the gap with
   `[VERIFY] local facts needed for {city}`.
5. Use honest coverage framing only. Do not imply jobs, results, or credentials the
   client has not confirmed.
6. Explain the service clearly: what it is, what the process looks like, what the
   customer can expect, and how the business approaches it.
7. Use H2/H3 headings that include relevant secondary keywords naturally.
8. End with a service-specific call to action that references the actual service and
   outcome (no generic "contact us today"). Use the client's primary CTA framing
   from the client facts, but never put a phone number in the body.

## Output
Return only the Markdown page body, starting with an H1 that contains the primary
keyword. Do not wrap the output in code fences.
