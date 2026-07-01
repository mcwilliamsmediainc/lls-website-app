/**
 * wp-theme-deploy — install + activate the reusable LLS Local 40 master theme on a
 * managed-hosting client's WordPress server.
 *
 * This replaces the old assumption that intake builds a bespoke theme per client:
 * every Local 40 site now runs the single master theme (env.masterThemeSlug,
 * default "lls-local-40"), and only its config.php differs per client. This handler
 * uploads the theme directory over SFTP to <server_path>/wp-content/themes/<slug>
 * and activates it via remote WP-CLI, using the same per-client SSH key model as
 * wp_intake (Plesk subscription user, never root).
 *
 * Trigger: a wp_theme_deploy job for a managed_hosting client. Safe to re-run: the
 * remote theme directory is replaced cleanly on each deploy (idempotent).
 *
 * Failure modes (mirrors wp_intake):
 *  - missing server details / SSH key -> needs_review
 *  - SSH connection failure           -> needs_review
 *  - WP-CLI not usable on host        -> needs_review (theme uploaded, not activated)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { Client } from "ssh2";
import type { ConnectConfig, SFTPWrapper } from "ssh2";
import { api } from "../lib/apiClient.js";
import { getClientRow } from "../lib/db.js";
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

function openSftp(conn: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
  });
}

/** mkdir that tolerates an already-existing directory. */
function sftpMkdir(sftp: SFTPWrapper, dir: string): Promise<void> {
  return new Promise((resolve) => {
    sftp.mkdir(dir, () => resolve()); // ignore errors (EEXIST is fine; a real failure surfaces on fastPut)
  });
}

function sftpPut(sftp: SFTPWrapper, local: string, remote: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
  });
}

/** Collect files (and the set of directories) under a theme dir, relative to it. */
function walkTheme(root: string): { files: string[]; dirs: string[] } {
  const files: string[] = [];
  const dirs = new Set<string>();
  const recurse = (relDir: string) => {
    const abs = relDir ? join(root, relDir) : root;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const rel = relDir ? posix.join(relDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        dirs.add(rel);
        recurse(rel);
      } else if (entry.isFile()) {
        files.push(rel);
      }
    }
  };
  recurse("");
  // Shallow dirs first so parents are created before children.
  return { files, dirs: [...dirs].sort((a, b) => a.split("/").length - b.split("/").length) };
}

export const wpThemeDeploy: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const slug = env.masterThemeSlug;
  const srcDir = env.themeSrcDir || join(process.cwd(), "wordpress-themes", slug);

  const client = await getClientRow(payload.clientId);
  if (!client) {
    return { outputFiles: [], log: ["Client not found"], status: "failed", errorMessage: `No client row for id ${payload.clientId}` };
  }
  if (!client.managedHosting) {
    return {
      outputFiles: [],
      log: ["Client is not flagged managed_hosting"],
      status: "needs_review",
      errorMessage: "wp_theme_deploy requires managed_hosting=true (SSH + WP-CLI access to the client's WordPress server)",
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
      errorMessage: `wp_theme_deploy needs server_host, server_user, server_path on the client; missing: ${missing}`,
    };
  }

  // Confirm the theme source exists in the worker image before we connect.
  let themeFiles: { files: string[]; dirs: string[] };
  try {
    if (!statSync(join(srcDir, "style.css")).isFile()) throw new Error("style.css missing");
    themeFiles = walkTheme(srcDir);
    if (themeFiles.files.length === 0) throw new Error("no files found");
  } catch (err) {
    return {
      outputFiles: [],
      log: [`Master theme source not found at ${srcDir}`],
      status: "failed",
      errorMessage: `Master theme source unreadable at ${srcDir}: ${err instanceof Error ? err.message : String(err)}. Set THEME_SRC_DIR or rebuild the worker image so wordpress-themes/${slug} is present.`,
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
      errorMessage: `SSH key not readable at ${env.sshKeyPath}: ${err instanceof Error ? err.message : String(err)}. Provision and mount the key or deploy the theme manually.`,
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
    const themesDir = posix.join(P, "wp-content", "themes");
    const themeDir = posix.join(themesDir, slug);

    // Clean-deploy: remove any prior copy so files deleted across theme versions do
    // not linger. Scoped strictly to this theme's own directory.
    if (!themeDir.endsWith(`/${slug}`)) {
      return { outputFiles: [], log, status: "failed", errorMessage: `Refusing to deploy: unexpected theme path ${themeDir}` };
    }
    await sshExec(conn, `rm -rf ${themeDir}`);

    // Upload the theme over SFTP.
    const sftp = await openSftp(conn);
    await sftpMkdir(sftp, themesDir); // themes dir normally exists; harmless if so
    await sftpMkdir(sftp, themeDir);
    for (const d of themeFiles.dirs) {
      await sftpMkdir(sftp, posix.join(themeDir, d));
    }
    for (const f of themeFiles.files) {
      await sftpPut(sftp, join(srcDir, f), posix.join(themeDir, f));
    }
    log.push(`Uploaded ${themeFiles.files.length} theme files to ${themeDir}`);

    // Activate via WP-CLI. env.wpCli may carry a full "php-binary ... wp-phar" prefix.
    const wp = env.wpCli;
    const activate = await sshExec(conn, `${wp} theme activate ${slug} --path=${P}`);
    const wpCliUnavailable =
      activate.code === 127 ||
      /command not found|not found|No such file|WP-CLI requires PHP|Error establishing/i.test(activate.stderr);
    if (wpCliUnavailable) {
      return {
        outputFiles: [],
        log,
        status: "needs_review",
        errorMessage: `Theme uploaded to ${themeDir} but WP-CLI could not activate it on ${host} (exit ${activate.code}): ${activate.stderr.trim().slice(0, 300) || "no output"}. Check WP_CLI_BIN or activate '${slug}' manually.`,
      };
    }
    if (activate.code !== 0) {
      return {
        outputFiles: [],
        log,
        status: "needs_review",
        errorMessage: `Theme uploaded but 'wp theme activate ${slug}' exited ${activate.code}: ${activate.stderr.trim().slice(0, 300) || activate.stdout.trim().slice(0, 300)}`,
      };
    }
    log.push(`Activated theme '${slug}': ${activate.stdout.trim().slice(0, 200)}`);

    await api.completeChecklistItem(payload.clientSlug, "wp_theme_deploy job complete").catch(() => undefined);

    return { outputFiles: [], log, status: "completed" };
  } finally {
    conn.end();
  }
};
