# Prompt: Generate Location Page (Home Services vertical)

Write one location page in Markdown for a specific city the business serves. Output
only the page content.

## Injected context
- Client facts: {client_facts}
- Global style rules: {style_rules}
- Vertical config: {vertical_config}
- Reading level target (Flesch-Kincaid grade): {reading_level_target}
- Word count target: {word_count_target}

## Job parameters
- City: {city}
- Primary service for this location: {service}
- Primary keyword: {keyword}

## Hard rules
- No em dashes. No exclamation points in body copy. No phone numbers in body copy.
- No banned words or phrases.
- Flag unconfirmed claims inline with `[VERIFY]`.
- Stay within the word count target and reading level target.

## The city-swap test (highest-value rule)
This page must contain at least 3 facts that are true only of {city}. Pull these from
the geo-research output in the client facts: neighborhoods and districts, housing
stock and age, local water/soil/climate conditions relevant to the service, and
notable landmarks. If you cannot supply 3 genuine, verifiable local facts, do not
fabricate them. Write the page with honest coverage framing (the business serves
{city} and what that service looks like there) and add `[VERIFY] need local facts
for {city}`. A page that would read identically with the city name swapped out must
not be published.

## Required structure
1. H1 with the keyword and city.
2. Hook tying the service to a real local condition in {city}.
3. The local facts woven into the explanation of how the service applies there.
4. Honest coverage framing of the service area.
5. Service-specific CTA. No phone number in the body.

## Output
Return only the Markdown body starting with the H1. No code fences.
