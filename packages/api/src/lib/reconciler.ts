/**
 * Orphaned-job reconciler.
 *
 * Queueing a job is a two-step write (lib/queue.ts + routes/jobs.ts): INSERT the
 * `jobs` row, then enqueue a BullMQ job onto its Redis queue. If the process dies
 * or Redis is briefly unreachable between those steps, the row commits but the
 * BullMQ job never lands — the row then sits in `queued` forever and no worker
 * ever picks it up (exactly the truskett-law site_scrape orphan on 2026-06-23).
 *
 * This loop periodically finds `queued` rows older than a grace window that have
 * no live BullMQ job and re-enqueues them. Because enqueueJob() sets the BullMQ
 * job id to the row id, re-enqueuing a row that is in fact still queued/active is
 * an idempotent no-op, so the reconciler can run safely alongside normal traffic.
 */

import { and, eq, lt } from "drizzle-orm";
import { db, jobs, clients } from "./db.js";
import { getQueue, enqueueJob, isJobType, bullJobId } from "./queue.js";

/** Ignore rows younger than this — an enqueue may still be in flight. */
const GRACE_MS = 60_000;
/** How often to scan for orphans. */
const INTERVAL_MS = 60_000;

/** One reconciliation pass. Returns the number of jobs re-enqueued. */
export async function reconcileOrphanedJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - GRACE_MS);
  const rows = await db
    .select({
      id: jobs.id,
      taskType: jobs.taskType,
      clientId: jobs.clientId,
      params: jobs.payload,
      slug: clients.slug,
    })
    .from(jobs)
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .where(and(eq(jobs.status, "queued"), lt(jobs.queuedAt, cutoff)));

  let repaired = 0;
  for (const row of rows) {
    if (!isJobType(row.taskType)) {
      console.warn(`[reconciler] job ${row.id} has unknown task type "${row.taskType}", skipping`);
      continue;
    }

    const existing = await getQueue(row.taskType).getJob(bullJobId(row.id));
    if (existing) {
      // A BullMQ job with this id exists. If it already finished, the DB row is
      // stale for a different reason (a lost completion callback, not a lost
      // enqueue) — surface it but never re-run, to avoid a duplicate scrape.
      const state = await existing.getState();
      if (state === "completed" || state === "failed") {
        console.warn(
          `[reconciler] job ${row.id} is "queued" in DB but BullMQ state is "${state}" — ` +
            `likely a lost worker callback, not an orphaned enqueue. Not re-running.`
        );
      }
      continue;
    }

    await enqueueJob({
      jobId: row.id,
      clientId: row.clientId,
      clientSlug: row.slug,
      taskType: row.taskType,
      params: row.params ?? {},
    });
    repaired++;
    console.warn(`[reconciler] re-enqueued orphaned job ${row.id} (${row.taskType}, ${row.slug})`);
  }

  if (repaired > 0) console.warn(`[reconciler] re-enqueued ${repaired} orphaned job(s)`);
  return repaired;
}

/**
 * Start the periodic reconciler. Runs once immediately (to catch anything
 * orphaned while the API was down) then on a fixed interval. Returns a stop fn.
 */
export function startReconcilerLoop(): () => void {
  const tick = () => {
    reconcileOrphanedJobs().catch((err) =>
      console.error("[reconciler] scan failed:", err instanceof Error ? err.message : err)
    );
  };
  tick();
  const timer = setInterval(tick, INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
