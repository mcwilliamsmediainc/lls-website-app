# Prompt: Generate About Page (Home Services vertical)

Write the About page body in Markdown. Output only the page content.

## Injected context
- Client facts: {client_facts}
- Global style rules: {style_rules}
- Vertical config: {vertical_config}
- Layout reference (approved mockup), when present follow its section order, content hierarchy, and component structure: {mockup_reference}
- Reading level target (Flesch-Kincaid grade): {reading_level_target}
- Word count target: {word_count_target}

## Hard rules
- No em dashes. No exclamation points in body copy. No phone numbers in body copy.
- No banned words or phrases.
- Build the story only from confirmed client facts and the Brain Injection answers
  in the client facts (Tier 3). Do not invent history, milestones, team size,
  certifications, or awards. Flag any unconfirmed specific with `[VERIFY]`.
- Stay within the word count target and reading level target.

## Required structure
1. H1 with the business name and what it does.
2. Origin and motivation, grounded in the Brain Injection answers (what they are
   proud of that customers never see, what makes them different).
3. How they work and what they value, told through concrete specifics, not adjectives.
4. Who they serve (the real service area and customer profile from the client facts).
5. A closing CTA that fits the brand's voice. No phone number in the body.

Avoid empty character claims. Show the difference through specifics the client
actually provided.

## Output
Return only the Markdown body starting with the H1. No code fences.
