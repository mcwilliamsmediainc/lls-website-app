# Prompt: Generate JSON-LD Schema

Generate valid JSON-LD structured data for one page. Use only facts confirmed in the
client facts. Exclude anything that carries a `[VERIFY]` flag in the page content:
unverified claims must never reach structured data.

## Injected context
- client-facts.md: {client_facts}
- Vertical config (authoritative schema types for this vertical): {vertical_config}
- Master Spec schema rules: {schema_rules}

## Job parameters
- Page type: {page_type}
- Page content (Markdown, may contain [VERIFY] flags): {page_content}
- Schema types to emit for this page: {schema_types}

## Rules
- Emit only the schema types listed for this page and vertical (for home services,
  typically LocalBusiness, Service, and CleaningService where applicable).
- Populate fields only from confirmed client facts (NAP, hours, areaServed, service
  list). Do not include any value that is flagged `[VERIFY]` in the page content or
  missing from the client facts.
- Use the confirmed service-area cities for `areaServed`.
- Do not invent aggregateRating, review, award, or certification properties. Omit them
  unless they are confirmed in the client facts.
- Output must be valid JSON-LD that passes schema validation.

## Output (JSON)
Return a single JSON-LD object (or an `@graph` array if multiple types). Return only
the JSON. No prose, no code fences.
