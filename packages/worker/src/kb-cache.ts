/**
 * Knowledge Base cache (kickoff prompt Section 9).
 *
 * On worker start, fetch all KB documents from the Google Drive KB folder and cache
 * them in memory. Refresh every 60 minutes.
 *  - If Drive is unreachable and cache is < 24h old: proceed with stale cache, warn.
 *  - If cache is > 24h old and Drive is unreachable: hold the job (throw KbStaleError).
 *
 * Fetch uses the Google Drive API v3 with GOOGLE_DRIVE_OAUTH_TOKEN. Google Docs are
 * exported as plain text; other files are downloaded as-is.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./lib/env.js";

const STALE_HARD_LIMIT_MS = 24 * 60 * 60 * 1000;

/** Locate the in-repo knowledge-base/ folder (fallback when Drive is not wired). */
function findLocalKbDir(): string | null {
  if (process.env.KB_LOCAL_DIR) return process.env.KB_LOCAL_DIR;
  const candidates: string[] = [resolve(process.cwd(), "knowledge-base")];
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    candidates.push(resolve(dir, "knowledge-base"));
    dir = resolve(dir, "..");
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

function loadLocalKb(): Record<string, string> {
  const dir = findLocalKbDir();
  if (!dir) return {};
  const docs: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".md")) {
      try {
        docs[name] = readFileSync(resolve(dir, name), "utf8");
      } catch {
        /* ignore unreadable file */
      }
    }
  }
  return docs;
}

export class KbStaleError extends Error {
  constructor(ageMinutes: number) {
    super(`KB cache is ${ageMinutes} minutes old and Google Drive is unreachable`);
    this.name = "KbStaleError";
  }
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface KbState {
  docs: Record<string, string>;
  fetchedAt: number | null;
  lastError: string | null;
}

const state: KbState = { docs: {}, fetchedAt: null, lastError: null };

async function listFolder(folderId: string, token: string): Promise<DriveFile[]> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
  url.searchParams.set("fields", "files(id,name,mimeType)");
  url.searchParams.set("pageSize", "100");
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

async function readFile(file: DriveFile, token: string): Promise<string> {
  const isGoogleDoc = file.mimeType.startsWith("application/vnd.google-apps");
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`
    : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive read ${file.name} failed: ${res.status}`);
  return res.text();
}

/** Force a refresh from Drive. Swallows errors into state.lastError so callers can
 * decide whether to proceed on stale cache. */
export async function refreshKbCache(): Promise<void> {
  if (!env.googleDriveKbFolderId || !env.googleDriveOauthToken) {
    // No Drive wiring: fall back to the in-repo knowledge-base/ folder so local
    // runs still inject the real Style Rules and vertical configs.
    const local = loadLocalKb();
    if (Object.keys(local).length) {
      state.docs = local;
      state.fetchedAt = Date.now();
      state.lastError = null;
      console.log(`[kb] loaded ${Object.keys(local).length} docs from local knowledge-base/`);
    } else {
      state.lastError = "Google Drive KB not configured and no local knowledge-base/ found";
    }
    return;
  }
  try {
    const files = await listFolder(env.googleDriveKbFolderId, env.googleDriveOauthToken);
    const docs: Record<string, string> = {};
    for (const f of files) {
      try {
        docs[f.name] = await readFile(f, env.googleDriveOauthToken);
      } catch (err) {
        console.warn(`[kb] failed to read ${f.name}:`, err);
      }
    }
    state.docs = docs;
    state.fetchedAt = Date.now();
    state.lastError = null;
    console.log(`[kb] cache refreshed: ${Object.keys(docs).length} documents`);
  } catch (err) {
    state.lastError = String(err);
    console.warn("[kb] refresh failed, keeping existing cache:", err);
  }
}

export function cacheAgeMinutes(): number | null {
  if (!state.fetchedAt) return null;
  return Math.round((Date.now() - state.fetchedAt) / 60000);
}

export interface KbContext {
  docs: Record<string, string>;
  ageMinutes: number;
  stale: boolean; // true when there was a recent fetch error but cache is usable
}

/**
 * Returns the KB context for building a job payload, applying the staleness policy.
 * Throws KbStaleError when the cache is older than 24h and Drive is unreachable.
 */
export function getKbContext(): KbContext {
  const age = cacheAgeMinutes();
  const driveDown = state.lastError !== null;

  if (state.fetchedAt === null) {
    // Never successfully fetched.
    if (driveDown) throw new KbStaleError(Number.MAX_SAFE_INTEGER);
    return { docs: {}, ageMinutes: 0, stale: false };
  }

  const ageMs = Date.now() - state.fetchedAt;
  if (driveDown && ageMs > STALE_HARD_LIMIT_MS) {
    throw new KbStaleError(age ?? 0);
  }

  return { docs: state.docs, ageMinutes: age ?? 0, stale: driveDown };
}

/** Convenience to fetch a single KB doc by name (returns "" if absent). */
export function kbDoc(name: string): string {
  return state.docs[name] ?? "";
}

/** Starts the periodic refresh loop. Returns a stop function. */
export function startKbRefreshLoop(): () => void {
  const timer = setInterval(() => {
    void refreshKbCache();
  }, env.kbCacheRefreshMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
