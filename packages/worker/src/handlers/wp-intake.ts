/**
 * wp-intake — intake for managed-hosting clients.
 *
 * SSHes into the client's WordPress server (key at env.sshKeyPath), runs WP-CLI to
 * extract site structure + content, asks Claude to structure it into the
 * client-facts.md Tier 1 brief, and writes both the structured client-facts.md and
 * a raw wp-data.json to the workspace. Trigger: clients with managed_hosting=true,
 * queued as a wp_intake job.
 *
 * Failure modes (per spec):
 *  - SSH connection failure        -> needs_review (error includes the SSH error)
 *  - WP-CLI not available on host   -> needs_review (suggest manual intake)
 *  - an individual command fails    -> log it, continue, note it in the output
 */

import { readFileSync } from "node:fs";
import { Client } from "ssh2";
import type { ConnectConfig } from "ssh2";
import { callClaude } from "../lib/anthropic.js";
import { api } from "../lib/apiClient.js";
import { getClientRow } from "../lib/db.js";
import { kbDoc } from "../kb-cache.js";
import { env } from "../lib/env.js";
import { type JobHandler, type HandlerResult } from "../lib/types.js";

interface CmdResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Open an SSH connection, resolving once authenticated. */
function sshConnect(cfg: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("error", (err) => reject(err))
      .connect(cfg);
  });
}

/** Run one command over an open SSH connection, capturing stdout/stderr/exit code. */
function sshExec(conn: Client, cmd: string): Promise<CmdResult> {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream
        .on("close", (code: number | null) => resolve({ code: code ?? 0, stdout, stderr }))
        .on("data", (d: Buffer) => {
          stdout += d.toString();
        })
        .stderr.on("data", (d: Buffer) => {
          stderr += d.toString();
        });
    });
  });
}

function tryJson<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

interface WpPageStub {
  ID: number;
  post_title?: string;
  post_name?: string;
  post_content?: string;
}

export const wpIntake: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const failures: string[] = [];
  const client = await getClientRow(payload.clientId);

  if (!client) {
    return { outputFiles: [], log: ["Client not found"], status: "failed", errorMessage: `No client row for id ${payload.clientId}` };
  }
  if (!client.managedHosting) {
    return {
      outputFiles: [],
      log: ["Client is not flagged managed_hosting"],
      status: "needs_review",
      errorMessage: "wp_intake requires managed_hosting=true; flag the client or run a site_scrape intake instead",
    };
  }
  const host = client.serverHost;
  const user = client.serverUser;
  const serverPath = client.serverPath;
  if (!host || !user || !serverPath) {
    const missing = [!host && "server_host", !user && "server_user", !serverPath && "server_path"].filter(Boolean).join(", ");
    return {
      outputFiles: [],
      log: ["Missing server connection details"],
      status: "needs_review",
      errorMessage: `wp_intake needs server_host, server_user, server_path on the client; missing: ${missing}`,
    };
  }

  // Load the SSH key.
  let privateKey: Buffer;
  try {
    privateKey = readFileSync(env.sshKeyPath);
  } catch (err) {
    return {
      outputFiles: [],
      log: [`SSH key not readable at ${env.sshKeyPath}`],
      status: "needs_review",
      errorMessage: `SSH key not readable at ${env.sshKeyPath}: ${err instanceof Error ? err.message : String(err)}. Provision the key (and mount it into the worker) or run intake manually.`,
    };
  }

  // Connect.
  let conn: Client;
  try {
    conn = await sshConnect({ host, port: 22, username: user, privateKey, readyTimeout: 20_000 });
  } catch (err) {
    return {
      outputFiles: [],
      log: [`SSH connection to ${user}@${host} failed`],
      status: "needs_review",
      errorMessage: `SSH connection failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    log.push(`SSH connected to ${user}@${host}`);
    const P = serverPath;

    // Runs a command, recording (but not throwing on) non-zero exits.
    const run = async (cmd: string, label: string): Promise<CmdResult> => {
      const r = await sshExec(conn, cmd);
      if (r.code !== 0) {
        failures.push(`${label}: exit ${r.code} ${r.stderr.trim().slice(0, 300)}`);
        log.push(`WP-CLI ${label} failed (exit ${r.code})`);
      }
      return r;
    };

    // First command doubles as a WP-CLI availability probe (exit 127 = not found).
    const blogname = await run(`wp option get blogname --path=${P} --format=json`, "option:blogname");
    if (blogname.code === 127 || /\bwp\b.*(command not found|not found|No such file)/i.test(blogname.stderr)) {
      return {
        outputFiles: [],
        log,
        status: "needs_review",
        errorMessage: `WP-CLI not available on ${host} (path ${P}): ${blogname.stderr.trim().slice(0, 300)}. Suggest manual intake.`,
      };
    }

    const siteurl = await run(`wp option get siteurl --path=${P} --format=json`, "option:siteurl");
    const blogdescription = await run(`wp option get blogdescription --path=${P} --format=json`, "option:blogdescription");
    const pages = await run(
      `wp post list --post_type=page --post_status=publish --fields=ID,post_title,post_name,post_content --format=json --path=${P}`,
      "pages"
    );
    const posts = await run(
      `wp post list --post_type=post --post_status=publish --fields=ID,post_title,post_name --format=json --path=${P}`,
      "posts"
    );
    const users = await run(`wp user list --fields=display_name,user_email,roles --format=json --path=${P}`, "users");
    const plugins = await run(`wp plugin list --status=active --format=json --path=${P}`, "plugins");
    const categories = await run(`wp term list category --format=json --path=${P}`, "categories");

    // Full content for each published page.
    const pageStubs = tryJson<WpPageStub[]>(pages.stdout) ?? [];
    log.push(`Found ${pageStubs.length} published pages`);
    const pagesFull: unknown[] = [];
    for (const p of pageStubs) {
      const r = await run(`wp post get ${p.ID} --fields=post_title,post_content,post_name --format=json --path=${P}`, `page:${p.ID}`);
      pagesFull.push(
        tryJson(r.stdout) ?? {
          ID: p.ID,
          post_title: p.post_title,
          post_name: p.post_name,
          post_content: p.post_content,
          _note: "fell back to list content",
        }
      );
    }

    // AIOSEO migration check.
    const aioseo = await run(
      `wp db query "SELECT post_id,meta_key,meta_value FROM wp_postmeta WHERE meta_key LIKE '_aioseo%' LIMIT 100" --path=${P} --format=json`,
      "aioseo"
    );

    const wpData = {
      extracted_at_path: P,
      server: { host, user },
      blogname: tryJson(blogname.stdout) ?? blogname.stdout.trim(),
      siteurl: tryJson(siteurl.stdout) ?? siteurl.stdout.trim(),
      blogdescription: tryJson(blogdescription.stdout) ?? blogdescription.stdout.trim(),
      pages: pagesFull,
      posts: tryJson(posts.stdout) ?? [],
      users: tryJson(users.stdout) ?? [],
      active_plugins: tryJson(plugins.stdout) ?? [],
      categories: tryJson(categories.stdout) ?? [],
      aioseo_postmeta: tryJson(aioseo.stdout) ?? aioseo.stdout.trim(),
      command_failures: failures,
    };

    // Raw dump for reference.
    await api.writeFile(payload.clientSlug, "wp-data.json", JSON.stringify(wpData, null, 2), "application/json");
    log.push("Wrote wp-data.json");

    // Structure into client-facts.md Tier 1 via Claude, using the vertical config.
    const siteType = client.siteType ?? "home_services";
    const config = kbDoc(`${siteType.replace(/_/g, "-")}-config.md`) || `(${siteType} vertical config unavailable)`;
    log.push(`Structuring client-facts.md with Claude (vertical: ${siteType})`);
    const clientFacts = await callClaude(buildStructuringPrompt(client.businessName, siteType, config, wpData), { budget: "page" });

    await api.writeFile(payload.clientSlug, "client-facts.md", clientFacts, "text/markdown");
    log.push("Wrote client-facts.md");

    await api.completeChecklistItem(payload.clientSlug, "wp_intake job complete").catch(() => undefined);

    return {
      outputFiles: ["client-facts.md", "wp-data.json"],
      log,
      status: "completed",
      errorMessage: failures.length
        ? `Completed with ${failures.length} WP-CLI command failure(s): ${failures.join(" | ").slice(0, 500)}`
        : undefined,
    };
  } finally {
    conn.end();
  }
};

/** Builds the Claude prompt that turns raw WP data into a Tier 1 client-facts.md. */
function buildStructuringPrompt(
  businessName: string,
  siteType: string,
  config: string,
  wpData: Record<string, unknown>
): string {
  // Bound the payload: truncate page bodies so the prompt stays within budget.
  const compact = {
    ...wpData,
    pages: (wpData.pages as Array<Record<string, unknown>>).map((p) => ({
      ...p,
      post_content: typeof p?.post_content === "string" ? (p.post_content as string).slice(0, 1500) : p?.post_content,
    })),
  };

  return `You are building an LLS client-facts.md intake brief from a WordPress site's extracted data.

Business: ${businessName}
Vertical: ${siteType}

VERTICAL CONFIG (style + schema guidance):
${config}

EXTRACTED WORDPRESS DATA (JSON):
${JSON.stringify(compact, null, 2)}

Produce a complete client-facts.md following EXACTLY this three-tier structure (keep the headings verbatim):

# client-facts.md — ${businessName}

## Tier 1 — Harvested, client confirms
- **Business name:**
- **Primary vertical:** ${siteType}
- **Sub-verticals:**
- **Location (city, state):**
- **NAP — address:**  [VERIFY]
- **NAP — phone:**  [VERIFY]
- **NAP — email:**  [VERIFY]
- **Hours:**
- **GBP primary category:**
- **GBP additional categories:**
- **Service list:**
- **Service areas (cities):**
- **Years in business:**  [VERIFY]
- **Public reviews:**  [PENDING]
- **Existing photos:**  [PENDING]
- **Existing site URL:** (use siteurl)
- **Schema markup present on current site:** (note AIOSEO meta if present)
- **Active plugins (harvested):**

## Tier 2 — Derived, flagged for confirmation
- **Primary vs secondary services (derived):**  [VERIFY with client]
- **Commercial / residential split (derived):**  [VERIFY with client]
- **Ideal-customer profile (derived):**  [VERIFY with client]
- **Per-city area facts:** [PENDING] populate via geo_research.

## Tier 3 — Brain Injection (client-only, via onboarding form)
- **What your best customers say about you:** [PENDING — awaiting client submission]
- **What you are most proud of that customers never see:** [PENDING — awaiting client submission]
- **Your best customer story:** [PENDING — awaiting client submission]
- **What makes you genuinely different from your top competitor:** [PENDING — awaiting client submission]
- **What you wish customers knew before they called you:** [PENDING — awaiting client submission]
- **Additional notes:** [PENDING — awaiting client submission]

Rules:
- Fill Tier 1 strictly from the extracted data. Derive services and sub-verticals from the page titles/content; NAP from page content or the users list; existing site URL from siteurl.
- Flag any unconfirmed marketing claim (awards, rankings, statistics, credentials) with [VERIFY].
- Leave EVERY Tier 3 field exactly as [PENDING — awaiting client submission].
- No em dashes. No exclamation points in body copy.
- Output ONLY the markdown file content, with no preamble, commentary, or code fences.`;
}
