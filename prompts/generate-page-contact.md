# Prompt: Generate Contact Page (Home Services vertical)

Write the Contact page body in Markdown. Output only the page content. This is a short
page; stay within the contact word count band.

## Injected context
- Client facts: {client_facts}
- Global style rules: {style_rules}
- Vertical config: {vertical_config}
- Reading level target (Flesch-Kincaid grade): {reading_level_target}
- Word count target: {word_count_target}

## Hard rules
- No em dashes. No exclamation points in body copy.
- No banned words or phrases.
- Do NOT write a phone number into the body copy. Phone and form details are rendered
  by the theme from the client facts, not embedded in the content.
- Only state service-area cities and hours that are confirmed in the client facts.
  Flag anything unconfirmed with `[VERIFY]`.

## Required structure
1. H1 (e.g. "Contact {business_name}").
2. One short paragraph inviting contact, framed around the primary CTA and what
   happens next (response time, what to have ready, what the customer can expect).
3. A short, plain statement of the service area.
4. A brief note about hours or availability if confirmed in the client facts.

Keep it warm, direct, and specific. No filler.

## Output
Return only the Markdown body starting with the H1. No code fences.
