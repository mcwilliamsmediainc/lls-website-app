/**
 * Thin client for the worker's callbacks into the API (spec Table 10).
 * Authenticates with the shared x-worker-token header.
 */

import { env } from "./env.js";

async function post<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-worker-token": env.workerToken },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json().catch(() => ({}))) as T;
}

async function get<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    headers: { "x-worker-token": env.workerToken },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export interface JobUpdate {
  jobId: number;
  status: "queued" | "running" | "completed" | "failed" | "gate_failed" | "held" | "needs_review";
  log?: string;
  outputFiles?: string[];
  errorMessage?: string;
  retryCount?: number;
  kbCacheAgeMinutes?: number;
  kbCacheWarn?: boolean;
}

export const api = {
  updateJob: (u: JobUpdate) => post("/api/jobs/update", u),

  writeFile: (slug: string, filename: string, content: string, contentType?: string) =>
    post(`/api/clients/${slug}/files`, { filename, content, contentType }),

  /** Write a binary file (e.g. a harvested image) to the workspace, base64-encoded. */
  writeBinaryFile: (slug: string, filename: string, bytes: Uint8Array, contentType?: string) =>
    post(`/api/clients/${slug}/files`, {
      filename,
      content: Buffer.from(bytes).toString("base64"),
      contentType,
      encoding: "base64",
    }),

  /** Register a harvested photo record (image_harvest). Worker-authed. */
  registerPhoto: (
    slug: string,
    body: {
      filename: string;
      source?: "client" | "gbp" | "ai_generated" | "licensed_stock";
      zoneType?: string;
      pageAssigned?: string;
      altText?: string;
      generationMetadata?: Record<string, unknown>;
    }
  ) => post(`/api/clients/${slug}/photos/harvest`, body),

  completeChecklistItem: (slug: string, item: string, status = "complete") =>
    post(`/api/clients/${slug}/checklist`, { item, status }),

  upsertContentPage: (body: {
    clientSlug: string;
    pageType: string;
    slug: string;
    title?: string;
    wordCount: number;
    verifyFlagsCount: number;
    gateStatus: "pending" | "passing" | "failed";
    gateFailureReason?: string | null;
    schemaGenerated?: boolean;
  }) => post("/api/content/upsert", body),

  markSchemaGenerated: (clientSlug: string, slug: string) =>
    post("/api/content/mark-schema", { clientSlug, slug }),

  allContentApproved: (slug: string) =>
    get<{ allApproved: boolean; total: number }>(`/api/clients/${slug}/content/all-approved`),

  getClientFacts: (slug: string) =>
    get<{ slug: string; clientFacts: string }>(`/api/clients/${slug}/facts`),

  /** Read the approved design mockup as a layout reference for generate_page.
   * Returns extracted text for HTML/SVG mockups, or a description for binary ones. */
  getMockup: (slug: string) =>
    get<{ hasMockup: boolean; approved: boolean; filePath?: string; isText: boolean; content: string }>(
      `/api/clients/${slug}/mockup/content`
    ),

  getPages: (slug: string) =>
    get<Array<{ slug: string; content: string }>>(`/api/clients/${slug}/pages`),

  getInventory: (slug: string) =>
    get<{ inventoryCsv: string }>(`/api/clients/${slug}/inventory`),

  heartbeat: (body: {
    workerId: string;
    jobsProcessed: number;
    currentJobId?: number | null;
    status: "idle" | "busy" | "draining" | "stopped";
  }) => post("/api/system/heartbeat", body),

  workerAlert: (workerId: string, lastSeenMinutesAgo: number) =>
    post("/api/system/worker-alert", { workerId, lastSeenMinutesAgo }),
};
