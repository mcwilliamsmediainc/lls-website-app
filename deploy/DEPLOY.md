# LLS Build Workspace — Droplet Deploy Runbook

This bundle turns the 9-step droplet setup into a corrected, runnable form. Read the
prerequisites first — two things in the original plan do not work as written.

## Prerequisites (do these first)

1. **Push the repo to GitHub.** `git clone https://github.com/mcwilliamsmediainc/lls-website-app.git`
   will fail until the code is actually pushed. From the project root:

   ```bash
   git remote add origin https://github.com/mcwilliamsmediainc/lls-website-app.git
   git push -u origin main
   ```

   (Make the repo private — it contains internal worker instructions. The droplet
   clones over HTTPS, so use a deploy key or a PAT if it is private.)

2. **Rotate any API keys** that were shared in chat or email before putting them on a
   public host. Generate fresh Anthropic and Gemini keys.

3. **Use real secrets.** Generate `AUTH_SECRET`, `WORKER_API_TOKEN`, and
   `SEED_DEFAULT_PASSWORD` with `openssl rand -hex 32`. Do not ship the localhost
   defaults to a public IP.

## What changed from the original 9 steps

- **Env vars:** only `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, the secrets, and
  `DROPLET_PUBLIC_URL` are read. `DATABASE_URL`, `REDIS_URL`, and `MINIO_*` are
  hardcoded in `docker-compose.yml` and are ignored if set in `.env` (and the values
  in the original step 4 were wrong: Postgres is `lls:lls@postgres/lls`, object
  storage keys are `minioadmin`). See `.env.production.example`.
- **Containers:** `docker compose ps` shows **8** services. Six long-running
  (postgres, redis, minio, api, worker, web) plus two one-shot (`migrate`,
  `createbuckets`) that exit 0 after running. "All exited(0) for those two" is correct.
- **Migrations:** the `migrate` service already runs `pnpm db:migrate` (applies
  `0001_initial_schema`) and seeds on startup, so the manual step 7 is redundant. The
  bootstrap waits for it to finish.
- **Public host:** `deploy/docker-compose.override.yml` repoints CORS, onboarding
  links, and APP_URL at `DROPLET_PUBLIC_URL` so the app works over the droplet IP, not
  just localhost.

## Path A — fully automated (recommended)

Provision the droplet and DNS in one command using `doctl`. cloud-init installs Docker
and brings the stack up on first boot.

1. Edit `deploy/cloud-init.yaml` and set the three `REPLACE_ME` values
   (ANTHROPIC_API_KEY, AUTH_SECRET, WORKER_API_TOKEN, SEED_DEFAULT_PASSWORD). The
   public URL is filled in automatically from droplet metadata.
2. From the repo root:

   ```bash
   doctl auth init                  # once, with the McWilliams Media account
   doctl compute ssh-key list       # confirm the SSH key name
   SSH_KEY="McWilliams Media" ./deploy/provision-droplet.sh
   ```

3. The script prints the droplet IP and creates the DNS A records (step 9). Watch the
   build: `ssh root@<IP> 'tail -f /var/log/lls-bootstrap.log'`.
4. Open `http://<IP>:5173` — the LLS login screen (step 8).

## Path B — manual on an existing droplet

If the droplet already exists (created in the DO console per step 1, Ubuntu 22.04,
s-4vcpu-8gb, NYC1, McWilliams Media SSH key, hostname `lls-prod-01`):

```bash
ssh root@<IP>
git clone https://github.com/mcwilliamsmediainc/lls-website-app.git /opt/lls-website-app
cd /opt/lls-website-app
cp deploy/.env.production.example .env
nano .env                      # fill ANTHROPIC_API_KEY, AUTH_SECRET, WORKER_API_TOKEN,
                               # SEED_DEFAULT_PASSWORD, DROPLET_PUBLIC_URL=http://<IP>:5173
REPO_URL=https://github.com/mcwilliamsmediainc/lls-website-app.git ./deploy/bootstrap.sh
```

`bootstrap.sh` installs Docker (step 2), pulls (step 3), applies the override, builds
and starts the stack (step 5), waits for migrations (step 7), and prints status
(step 6). Then configure DNS with the records in `provision-droplet.sh` (step 9) or
the DO DNS panel.

## Login

After seeding, the team accounts exist with the `SEED_DEFAULT_PASSWORD` you set
(username `matt`, `tyler`, etc.). Change it on first login.

## Hardening before this is more than a smoke test

The compose profile is the dev stack (Vite dev server on 5173, MinIO, no TLS). For a
durable deployment: put Caddy or nginx in front on 80/443 with a real cert, serve the
web app as a static `vite build` instead of the dev server, move secrets to a manager,
and restrict the Postgres/Redis/MinIO ports to the internal network. Track this as a
follow-up; it is not required for pipeline testing.
