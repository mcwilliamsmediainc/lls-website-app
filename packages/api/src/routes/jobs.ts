/**
 * Job routes: queue a job (DB row + BullMQ enqueue), list/get, and the worker
 * progress callback POST /api/jobs/update (spec Table 10).
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq, desc, isNull } from "drizzle-orm";
import { db, jobs, clients, contentPages } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { requireWorker } from "../middleware/worker.js";
import { jobDispatchLimiter } from "../middleware/rateLimit.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { enqueueJob, isJobType } from "../lib/queue.js";
import { writeAudit } from "../lib/audit.js";

export const jobsRouter = Router();

const queueSchema = z.object({
  clientSlug: z.string().min(1),
  taskType: z.string().min(1),
  params: z.record(z.unknown()).default({}),
});

/** Queue a job. All roles may queue (spec Table 28). */
jobsRouter.post(
  "/",
  requireAuth,
  requirePermission("queue_job"),
  jobDispatchLimiter,
  asyncHandler(async (req, res) => {
    const { clientSlug, taskType, params } = queueSchema.parse(req.body);
    const auth = req.auth!;
    if (!isJobType(taskType)) throw new HttpError(400, `Unknown task type: ${taskType}`);

    const [client] = await db.select().from(clients).where(eq(clients.slug, clientSlug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");

    // internal_linking requires every Phase 1 content page to be approved
    // (spec Table 26). Enforce it here rather than relying on the worker hold.
    if (taskType === "internal_linking") {
      const pages = await db
        .select({ slug: contentPages.slug, title: contentPages.title, status: contentPages.status })
        .from(contentPages)
        .where(and(eq(contentPages.clientId, client.id), isNull(contentPages.deletedAt)));
      if (pages.length === 0) {
        throw new HttpError(409, "Cannot queue internal_linking: no content pages exist for this client yet");
      }
      const unapproved = pages.filter((p) => p.status !== "approved");
      if (unapproved.length > 0) {
        const names = unapproved.map((p) => `${p.title ?? p.slug} (${p.status})`);
        throw new HttpError(
          409,
          `Cannot queue internal_linking: ${unapproved.length} page(s) not approved: ${names.join(", ")}`
        );
      }
    }

    const [job] = await db
      .insert(jobs)
      .values({
        clientId: client.id,
        taskType,
        status: "queued",
        queuedBy: auth.sub,
        payload: params,
      })
      .returning();
    if (!job) throw new HttpError(500, "Failed to create job");

    await enqueueJob({
      jobId: job.id,
      clientId: client.id,
      clientSlug: client.slug,
      taskType,
      params,
    });

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "queue_job",
      entityType: "job",
      entityId: job.id,
      newValue: { taskType, clientSlug },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json(job);
  })
);

/** List jobs, optionally filtered by client slug. */
jobsRouter.get(
  "/",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const slug = req.query.clientSlug ? String(req.query.clientSlug) : null;
    if (slug) {
      const [client] = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
      if (!client) throw new HttpError(404, "Client not found");
      const rows = await db.select().from(jobs).where(eq(jobs.clientId, client.id)).orderBy(desc(jobs.queuedAt));
      res.json(rows);
      return;
    }
    const rows = await db.select().from(jobs).orderBy(desc(jobs.queuedAt)).limit(200);
    res.json(rows);
  })
);

jobsRouter.get(
  "/:id",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) throw new HttpError(404, "Job not found");
    res.json(job);
  })
);

/** Worker callback: progress + completion (spec Table 10). */
const updateSchema = z.object({
  jobId: z.number().int(),
  status: z.enum(["queued", "running", "completed", "failed", "gate_failed", "held", "needs_review"]),
  log: z.string().optional(),
  outputFiles: z.array(z.string()).optional(),
  errorMessage: z.string().optional(),
  retryCount: z.number().int().optional(),
  kbCacheAgeMinutes: z.number().int().optional(),
  kbCacheWarn: z.boolean().optional(),
});

jobsRouter.post(
  "/update",
  requireWorker,
  asyncHandler(async (req, res) => {
    const u = updateSchema.parse(req.body);
    const [existing] = await db.select().from(jobs).where(eq(jobs.id, u.jobId)).limit(1);
    if (!existing) throw new HttpError(404, "Job not found");

    const set: Record<string, unknown> = { status: u.status };
    if (u.log !== undefined) set.log = existing.log + (existing.log ? "\n" : "") + u.log;
    if (u.outputFiles !== undefined) set.outputFiles = u.outputFiles;
    if (u.errorMessage !== undefined) set.errorMessage = u.errorMessage;
    if (u.retryCount !== undefined) set.retryCount = u.retryCount;
    if (u.kbCacheAgeMinutes !== undefined) set.kbCacheAgeMinutes = u.kbCacheAgeMinutes;
    if (u.kbCacheWarn !== undefined) set.kbCacheWarn = u.kbCacheWarn;
    if (u.status === "running" && !existing.startedAt) set.startedAt = new Date();
    if (["completed", "failed", "gate_failed"].includes(u.status)) set.completedAt = new Date();

    const [updated] = await db.update(jobs).set(set).where(eq(jobs.id, u.jobId)).returning();
    res.json(updated);
  })
);
