# Prompt: Gap Report

Compare the client's existing site against the LLS page taxonomy and the required
client-facts fields. Identify what is missing, thin, duplicated, or unverified.
Output a clear, prioritized report the team can act on.

## Injected context
- client-facts.md: {client_facts}
- Image Standard L40-22 (for image gap rules): {image_standard}
- LLS page taxonomy and required fields: {taxonomy}
- Existing site inventory (from site_scrape): {site_inventory}
- Image inventory: {image_inventory}

## Analyze and report
1. Missing pages: required page types not present (home, services, per-service,
   per-location, about, contact, FAQ as applicable to the vertical).
2. Thin pages: existing pages well below the word-count band for their type.
3. Duplicate or near-duplicate content (especially location pages that fail the
   city-swap test).
4. Missing or incomplete schema markup.
5. Image gaps by zone per L40-22 (which zones lack a compliant image source).
6. Missing client-facts fields still needed before content generation can begin.

## Output (Markdown)
Write a `gap-report.md` with sections for each category above. For each gap, give the
specific item, why it matters, and the recommended action. End with a short
"Blocking before content" list of items that must be resolved before generate_page
jobs are queued.

Return only the Markdown report. No code fences.
