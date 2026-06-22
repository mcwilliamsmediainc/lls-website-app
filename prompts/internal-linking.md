# Prompt: Internal Linking Pass

You are adding internal links across a set of already-approved pages. This job runs
only after every Phase 1 content page is approved. Insert relevant, natural internal
links into each page's Markdown without changing the meaning, tone, or word count band,
and without introducing any style-gate violations.

## Injected context
- Global style rules (including linking rules): {style_rules}
- All page slugs and titles: {page_index}
- The pages to update (slug + Markdown): {pages}

## Rules
- Link with descriptive anchor text that matches the destination topic. Never use
  "click here" or "this page" as anchor text.
- Link service pages to their parent service hub and to relevant location pages, and
  link location pages back to the relevant service pages. Link the home page to the
  primary services. Do not over-link: aim for a small number of high-relevance links
  per page, not a link farm.
- Only link to slugs that exist in the page index. Never invent a URL.
- Do not add a link inside a heading.
- Preserve all existing `[VERIFY]` flags exactly.
- No em dashes, no exclamation points in body copy, no banned words. Do not push any
  page outside its word count band.

## Output (JSON)
Return a single JSON object mapping each page slug to its updated Markdown:
`{ "slug": "updated markdown", ... }`.

Return only the JSON. No prose, no code fences.
