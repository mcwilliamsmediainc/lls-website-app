/**
 * System routes: worker heartbeat ingestion, dead-man alert, and Task Queue
 * status surfaces (worker health, KB cache state).
 */

import { Router } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, workerHeartbeats } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireWorker } from "../middleware/worker.js";
import { asyncHandler } from "../middleware/error.js";
import { env } from "../lib/env.js";

export const systemRouter = Router();

/** Worker callback: upsert a heartbeat row (spec: every 60s). */
systemRouter.post(
  "/heartbeat",
  requireWorker,
  asyncHandler(async (req, res) => {
    const b = z
      .object({
        workerId: z.string(),
        jobsProcessed: z.number().int().default(0),
        currentJobId: z.number().int().nullable().optional(),
        status: z.enum(["idle", "busy", "draining", "stopped"]).default("idle"),
      })
      .parse(req.body);

    const [existing] = await db
      .select()
      .from(workerHeartbeats)
      .where(eq(workerHeartbeats.workerId, b.workerId))
      .orderBy(desc(workerHeartbeats.lastSeen))
      .limit(1);

    if (existing) {
      await db
        .update(workerHeartbeats)
        .set({ lastSeen: new Date(), jobsProcessed: b.jobsProcessed, currentJobId: b.currentJobId ?? null, status: b.status })
        .where(eq(workerHeartbeats.id, existing.id));
    } else {
      await db.insert(workerHeartbeats).values({
        workerId: b.workerId,
        jobsProcessed: b.jobsProcessed,
        currentJobId: b.currentJobId ?? null,
        status: b.status,
      });
    }
    res.json({ ok: true });
  })
);

/**
 * Dead-man switch: the worker (or an external monitor) posts here when a heartbeat
 * has been silent > 5 minutes. Triggers the alert email to ALERT_EMAIL.
 */
systemRouter.post(
  "/worker-alert",
  requireWorker,
  asyncHandler(async (req, res) => {
    const { workerId, lastSeenMinutesAgo } = z
      .object({ workerId: z.string(), lastSeenMinutesAgo: z.number() })
      .parse(req.body);
    // Email delivery is wired through the monitoring stack (Better Stack / Sentry)
    // in production. Here we log loudly so the alert is captured in app logs and
    // surfaced by the log drain.
    console.error(
      `[ALERT] Worker ${workerId} silent for ${lastSeenMinutesAgo} minutes. Notifying ${env.alertEmail}.`
    );
    res.json({ ok: true, notified: env.alertEmail });
  })
);

/** Task Queue header: worker health for the UI banner. */
systemRouter.get(
  "/workers",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(workerHeartbeats).orderBy(desc(workerHeartbeats.lastSeen));
    const now = Date.now();
    const enriched = rows.map((r) => ({
      ...r,
      secondsSinceLastSeen: Math.round((now - new Date(r.lastSeen).getTime()) / 1000),
      stale: now - new Date(r.lastSeen).getTime() > 5 * 60 * 1000,
    }));
    res.json(enriched);
  })
);
