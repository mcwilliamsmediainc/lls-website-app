# Knowledge Base

These are the source documents for the LLS Knowledge Base. In production they live in
the Google Drive KB folder (`GOOGLE_DRIVE_KB_FOLDER_ID=1ZYap_nnnvj4q7Sx5jFrlnSHb_D4b9EUj`)
and the worker fetches them via the Google Drive MCP at job dispatch, caching them in
memory and refreshing every 60 minutes.

When Google Drive is not wired (local development), the worker falls back to reading
this folder directly, so the same documents are injected into jobs either way. Override
the location with `KB_LOCAL_DIR`.

## Documents here

| File                          | Injected into                                   |
| ----------------------------- | ----------------------------------------------- |
| L40-Global-Style-Rules.md     | every content generation job                    |
| home-services-config.md       | home-services jobs                              |
| dental-health-config.md       | dental/health jobs                             |
| legal-config.md               | legal jobs                                      |
| other-config.md               | "other" vertical jobs                          |
| client-facts-template.md      | shapes intake harvesting and the onboarding flow |

Filenames must match exactly — the worker looks up `L40-Global-Style-Rules.md` and
`<vertical>-config.md` (e.g. `home-services-config.md`) by name.

## Still to be added (have inline fallbacks until created)

The worker references these and uses inline fallbacks until the real docs are added:

- `LLS-Website-Complete-Specification.md` (Master Spec — taxonomy, schema rules, redirects)
- `L40-22-Image-Standard.md` (authoritative image hierarchy)
- `L40-gap-prompts.md` (L40-20 through L40-29 generation prompts)
- `Lessons-from-each-build.md` (validated patterns, updated after every build)

## Editing

Edit in Google Drive (native version history is the system of record). Keep
L40-Global-Style-Rules.md in sync with `style-gate/rules.json` and
`style-gate/word-count-targets.json` — the machine gate is the source of truth for
pass/fail, this doc is its human-readable companion.
