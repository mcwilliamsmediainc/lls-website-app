# Prompt: Geo Research (per service-area city)

You are sourcing genuine, verifiable local facts for one city in a business's service
area. These facts feed location pages and must pass the city-swap test: each fact must
be true only of this city, not generic to any town. Do not fabricate. If you are not
confident a fact is accurate, omit it rather than guess.

## Injected context
- client-facts.md: {client_facts}
- Vertical config (tells you which local conditions matter for this vertical):
  {vertical_config}

## Job parameters
- City, state: {city}
- Vertical: {vertical}

## Source these Tier 2 area facts for {city}
- Neighborhoods and districts residents would recognize
- Housing stock: typical era, construction styles, common issues relevant to the
  service (for example, older homes, slab vs basement, hard water, clay soil)
- Regional conditions relevant to the vertical (climate, water hardness, flooding or
  fire risk, seasonal patterns)
- Notable landmarks or anchors that locals reference
- Anything specific to {city} that genuinely affects how this service is delivered

## Output (JSON)
Return a single JSON object:
`{ city, state, neighborhoods: [string], housing_stock: [string],
   regional_conditions: [string], landmarks: [string], service_relevant_notes: [string],
   low_confidence: [string] }`.

Put anything you are unsure about in `low_confidence` so the team can verify it. Do not
pad the lists. Return only the JSON. No prose, no code fences.
