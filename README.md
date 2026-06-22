# LLS Production Build Workspace

Internal web app for **McWilliams Media** that takes local-business clients from intake
through a live WordPress site. This is the internal machine that runs the build pipeline —
not a client-facing product.

First client (proof of pipeline): **Tulsa Kwik Dry Total Cleaning** (Tulsa, OK — carpet
cleaning + water/fire restoration).

## Architecture

| Layer            | Tech                                             |
| ---------------- | ------------------------------------------------ |
| Backend API      | Node.js + Express + TypeScript                   |
| ORM              | Drizzle ORM                                      |
| Database         | PostgreSQL (Supabase)                            |
| Job queue        | BullMQ + Redis                                   |
| Worker           | Docker container consuming BullMQ queues         |
| Frontend         | React + Tailwind CSS (Vite)                      |
| Auth             | Auth.js with TOTP MFA                            |
| File storage     | DigitalOcean Spaces (S3-compatible)              |
| AI               | Anthropic Claude API (Sonnet)                    |
| Staging deploy   | WP-CLI + rsync over SSH                          |

Monorepo managed with **pnpm workspaces**.

```
packages/
  db/      Drizzle schema + migrations
  api/     Express REST API (auth, routes, permissions)
  worker/  BullMQ worker + job handlers
  web/     React + Vite + Tailwind frontend
prompts/   Claude prompt templates (one per job type)
style-gate/ Automated style gate (banned words, em dashes, word counts)
clients/   Per-client facts files
```

## Deploy (Tyler)

1. `git clone` this repo
2. `cp .env.example .env` and fill in every value
3. `pnpm install`
4. `pnpm db:migrate`  (applies the committed versioned migrations in `packages/db/drizzle`)
5. `pnpm db:seed`  (creates the initial team members + permission roles)
6. `pnpm build`
7. Build & deploy the worker Docker image (`packages/worker/Dockerfile`) to DigitalOcean
8. Start the API: `pnpm start:api`
9. Serve the web build (`packages/web/dist`) or run `pnpm dev:web` in dev

### Infrastructure prerequisites (must exist before jobs can run)
- DigitalOcean server provisioned
- Wildcard DNS `*.staging.locallaunchsystem.com` + wildcard SSL
- Redis provisioned (Upstash recommended)
- PostgreSQL on Supabase with schema migrated
- DigitalOcean Spaces bucket created
- Docker worker deployed

## First build (Matt)

1. Log in (MFA enrolled on first login)
2. Add **Tulsa Kwik Dry** as a client (slug `tulsa-kwik-dry`)
3. Intake checklist auto-creates; queue `site_scrape`, `gbp_verify`, `geo_research`, `gap_report`
4. Send the Brain Injection link from the client workspace
5. Review `client-facts.md`, then move to Content and queue page generation
6. Resolve [VERIFY] flags, pass the style gate, run internal linking + redirect map
7. Deploy to staging, QA, then Push to Live

## Scope (this build)

Phase 1 pipeline proof + Phase 2 team workflow surfaces. See `LLS-Production-System-Spec-v5.3.docx`.

**Not in this build:** wireframe stage/annotation tool, visual editor, scorecard UI/scoring,
monthly maintenance, AI image generation, GBP OAuth flow, MFA enrollment UI, change-ticket
system, client review link. Schema fields for these exist where the spec requires them.
