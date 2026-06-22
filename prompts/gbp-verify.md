# Prompt: GBP Verify

You are comparing a business's Google Business Profile (read via the least-friction
path) against the NAP and category facts already harvested into client-facts.md.
Identify matches, conflicts, and net-new facts. Do not fabricate. If the GBP data is
unavailable for a field, say so.

## Injected context
- client-facts.md (harvested so far): {client_facts}
- GBP listing data: {gbp_data}
- Vertical config: {vertical_config}

## Produce
1. NAP comparison: for name, address, phone, hours, and primary category, state
   whether GBP and client-facts agree, conflict, or one is missing. For conflicts,
   show both values.
2. Net-new facts from GBP not yet in client-facts (additional categories, attributes,
   service areas, photos available).
3. A list of fields to update in client-facts.md, with the GBP-sourced value and a
   confidence note.

## Output (JSON)
Return a single JSON object:
`{ nap_comparison: [{ field, status, client_facts_value, gbp_value }],
   net_new: [string], updates: [{ field, value, confidence }] }`.

Return only the JSON. No prose, no code fences.
