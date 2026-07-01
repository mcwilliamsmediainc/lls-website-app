/**
 * BullMQ producer side. The API enqueues jobs; the worker package consumes them.
 * One named queue per job type, matching the worker handler filenames.
 */

import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const JOB_TYPES = [
  "site_scrape",
  "gbp_verify",
  "geo_research",
  "gap_report",
  "generate_page",
  "generate_schema",
  "internal_linking",
  "redirect_map",
  "wireframe_generate",
  "url_inventory",
  "wp_intake",
  "wp_theme_deploy",
  "image_harvest",
  "wp_image_assign",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export const connection = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const queues = new Map<JobType, Queue>();

export function getQueue(type: JobType): Queue {
  let q = queues.get(type);
  if (!q) {
    q = new Queue(type, { connection });
    queues.set(type, q);
  }
  return q;
}

export interface JobPayload {
  /** Row id in the `jobs` table — the worker reports progress against this. */
  jobId: number;
  clientId: number;
  clientSlug: string;
  taskType: JobType;
  params: Record<string, unknown>;
}

/**
 * The BullMQ job id for a given jobs-table row id. Prefixed because BullMQ
 * rejects purely-numeric custom ids. Single source of truth for producer and
 * reconciler so the dedup lookup matches the enqueue.
 */
export function bullJobId(jobRowId: number): string {
  return `db-${jobRowId}`;
}

/** Enqueue a job onto its named queue. Returns the BullMQ job id. */
export async function enqueueJob(payload: JobPayload): Promise<string> {
  const q = getQueue(payload.taskType);
  const job = await q.add(payload.taskType, payload, {
    // Derive the BullMQ job id from the jobs-table row id so enqueues are
    // idempotent: re-adding the same row (e.g. by the orphaned-job reconciler) is
    // a dedup no-op rather than a second run. The "db-" prefix is required because
    // BullMQ rejects custom ids that are purely numeric ("Custom Id cannot be
    // integers"). The reconciler must use the same format. See lib/reconciler.ts.
    jobId: bullJobId(payload.jobId),
    attempts: 1, // retry policy is handled inside handlers (429 backoff) per spec
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  });
  return job.id ?? String(payload.jobId);
}

export function isJobType(value: string): value is JobType {
  return (JOB_TYPES as readonly string[]).includes(value);
}
