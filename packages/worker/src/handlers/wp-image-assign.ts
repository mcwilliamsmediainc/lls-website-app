/**
 * wp-image-assign — push a Photo Manager zone assignment to the staging WordPress.
 *
 * Triggered by POST /api/clients/:slug/photos/:id/assign. SSHes into the client's
 * managed WordPress server (same access model as wp_intake: per-client key at
 * env.sshKeyPath, authenticating as client.server_user, never root) and runs WP-CLI
 * to place the image:
 *   - "hero"/"featured" zones      -> set the page's featured image (_thumbnail_id)
 *   - any other zone               -> set a theme mod  lls_<pageSlug>_<zone>
 *
 * The image must already exist in the WordPress media library (wp_media_id, captured
 * by image_harvest on the managed path). Harvested-to-Spaces images that were never
 * imported into WP cannot be attached as a featured image, so the job returns
 * needs_review with a clear message rather than silently succeeding.
 *
 * Failure modes mirror wp_intake:
 *   - SSH connect failure / WP-CLI unavailable -> needs_review
 *   - page slug not found on the site           -> needs_review
 */

import { readFileSync } from "node:fs";
import { Client } from "ssh2";
import type { ConnectConfig } from "ssh2";
import { getClientRow } from "../lib/db.js";
import { env } from "../lib/env.js";
import { paramString } from "../lib/types.js";
import { type JobHandler, type HandlerResult } from "../lib/types.js";

interface CmdResult {
  code: number;
  stdout: string;
  stderr: string;
}

function sshConnect(cfg: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("error", (err) => reject(err))
      .connect(cfg);
  });
}

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

/** Zones that map to the WordPress featured image rather than a theme mod. */
const FEATURED_ZONES = new Set(["hero", "featured", "hero_banner", "page_header"]);

export const wpImageAssign: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const client = await getClientRow(payload.clientId);
  if (!client) {
    return { outputFiles: [], log: ["Client not found"], status: "failed", errorMessage: `No client row for id ${payload.clientId}` };
  }

  const pageSlug = paramString(payload.params, "pageSlug");
  const zone = paramString(payload.params, "zone");
  const filename = paramString(payload.params, "filename");
  const wpMediaIdRaw = payload.params.wpMediaId;
  const wpMediaId = typeof wpMediaIdRaw === "number" ? wpMediaIdRaw : Number(wpMediaIdRaw);

  if (!pageSlug || !zone) {
    return { outputFiles: [], log: ["Missing pageSlug/zone"], status: "failed", errorMessage: "wp_image_assign requires pageSlug and zone" };
  }

  const host = client.serverHost;
  const user = client.serverUser;
  const serverPath = client.serverPath;
  if (!client.managedHosting || !host || !user || !serverPath) {
    return {
      outputFiles: [],
      log: ["Client is not managed-hosting or is missing server connection details"],
      status: "needs_review",
      errorMessage: "wp_image_assign requires managed_hosting=true with server_host, server_user, server_path",
    };
  }

  if (!Number.isFinite(wpMediaId) || wpMediaId <= 0) {
    return {
      outputFiles: [],
      log: [`No WordPress media id for ${filename}; it was harvested to Spaces but never imported into the WP media library.`],
      status: "needs_review",
      errorMessage: `Cannot assign ${filename} to ${pageSlug}/${zone}: image is not in the WordPress media library. Import it into WP media first, then re-assign.`,
    };
  }

  let privateKey: Buffer;
  try {
    privateKey = readFileSync(env.sshKeyPath);
  } catch (err) {
    return {
      outputFiles: [],
      log: [`SSH key not readable at ${env.sshKeyPath}`],
      status: "needs_review",
      errorMessage: `SSH key not readable at ${env.sshKeyPath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

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
    const wp = env.wpCli;

    // Resolve the page's post ID from its slug (post_name).
    const idRes = await sshExec(
      conn,
      `${wp} post list --post_type=page --name=${pageSlug} --field=ID --format=ids --path=${P}`
    );
    const pageId = Number(idRes.stdout.trim().split(/\s+/)[0]);
    if (idRes.code !== 0 || !Number.isFinite(pageId) || pageId <= 0) {
      return {
        outputFiles: [],
        log: [...log, `Could not resolve page id for slug "${pageSlug}" (exit ${idRes.code})`],
        status: "needs_review",
        errorMessage: `Page slug "${pageSlug}" not found on ${host} (exit ${idRes.code}): ${idRes.stderr.trim().slice(0, 200) || "no output"}`,
      };
    }
    log.push(`Resolved page "${pageSlug}" -> post ${pageId}`);

    let cmd: string;
    let mode: string;
    if (FEATURED_ZONES.has(zone)) {
      cmd = `${wp} post meta update ${pageId} _thumbnail_id ${wpMediaId} --path=${P}`;
      mode = "featured image";
    } else {
      // Theme mod key namespaced per page + zone so multiple slots stay distinct.
      const modKey = `lls_${pageSlug}_${zone}`.replace(/[^a-z0-9_]/gi, "_");
      cmd = `${wp} theme mod set ${modKey} ${wpMediaId} --path=${P}`;
      mode = `theme mod ${modKey}`;
    }

    const res = await sshExec(conn, cmd);
    if (res.code !== 0) {
      return {
        outputFiles: [],
        log: [...log, `WP-CLI ${mode} update failed (exit ${res.code})`],
        status: "needs_review",
        errorMessage: `WP-CLI failed setting ${mode} on page ${pageId}: ${res.stderr.trim().slice(0, 300) || "no output"}`,
      };
    }

    log.push(`Set ${mode} = media ${wpMediaId} on page ${pageId} (${pageSlug}/${zone})`);
    return { outputFiles: [], log, status: "completed" };
  } finally {
    conn.end();
  }
};
