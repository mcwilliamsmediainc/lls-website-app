# Prompt: Site Scrape Extraction

You are extracting structured facts from a local business's existing website. You are
given the crawled page text and metadata. Produce a structured extraction that will
seed the Tier 1 fields of client-facts.md. Do not invent anything. If a field is not
found, write `not found` for it.

## Injected context
- client-facts.md template (shapes what to harvest): {client_facts}
- Crawled pages (URL + text): {crawled_pages}

## Extract
- Business name (as written on the site)
- NAP: name, address, phone, email
- Hours of operation
- Primary category and any additional categories implied by the content
- Service list (every distinct service offered)
- Service areas / cities mentioned
- Years in business, if stated (mark the source page)
- Any awards, certifications, licenses, or insurance claims found (copy them verbatim
  and note the page; these will require [VERIFY] before reuse)
- Existing schema markup types detected
- Page inventory: every URL with its detected page type (home, service, location,
  about, contact, blog, other)
- Representative content samples per page type (1-2 short excerpts)

## Output (JSON)
Return a single JSON object with keys:
`business_name, nap, hours, categories, services, service_areas, years_in_business,
unverified_claims, schema_types_present, page_inventory, content_samples`.

`page_inventory` is an array of `{ url, page_type, title }`.
`unverified_claims` is an array of `{ claim, source_url }`.

Return only the JSON. No prose, no code fences.
