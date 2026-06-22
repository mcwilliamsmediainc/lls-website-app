/**
 * Deployment routes: Push to Live and rollback.
 *
 * The two-operation push (rsync for files, WP-CLI for wp_posts + wp_postmeta —
 * never wp_options) is executed by the deploy script the worker/host runs with
 * the per-client SSH key from Supabase Vault. This route records the deployment,
 * enforces the matrix + rate limit, and writes the audit trail. The worker
 * reports the final file_count and status back via POST /api/deployments/:id/result.
 */

import { Router } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, clients, deployments } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { requireWorker } from "../middleware/worker.js";
import { pushToLiveLimiter } from "../middleware/rateLimit.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { writeAudit } from "../lib/audit.js";

export const deploymentsRouter = Router();

deploymentsRouter.get(
  "/clients/:slug/deployments",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const [client] = await db.select().from(clients).where(eq(clients.slug, req.params.slug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");
    const rows = await db
      .select()
      .from(deployments)
      .where(eq(deployments.clientId, client.id))
      .orderBy(desc(deployments.pushedAt));
    res.json(rows);
  })
);

deploymentsRouter.post(
  "/clients/:slug/push-to-live",
  requireAuth,
  requirePermission("push_to_live"),
  pushToLiveLimiter,
  asyncHandler(async (req, res) => {
    const { notes } = z.object({ notes: z.string().optional() }).parse(req.body);
    const auth = req.auth!;
    const [client] = await db.select().from(clients).where(eq(clients.slug, req.params.slug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");

    const [deployment] = await db
      .insert(deployments)
      .values({ clientId: client.id, pushedBy: auth.sub, status: "in_progress", notes: notes ?? null })
      .returning();

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "push_to_live",
      entityType: "deployment",
      entityId: deployment!.id,
      newValue: { clientSlug: client.slug },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json(deployment);
  })
);

/** Worker callback: report push result (file count, snapshot path, status). */
deploymentsRouter.post(
  "/deployments/:id/result",
  requireWorker,
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = z
      .object({
        status: z.enum(["success", "failed"]),
        fileCount: z.number().int().default(0),
        snapshotPath: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);
    const [updated] = await db
      .update(deployments)
      .set({ status: body.status, fileCount: body.fileCount, snapshotPath: body.snapshotPath ?? null, notes: body.notes })
      .where(eq(deployments.id, id))
      .returning();
    if (!updated) throw new HttpError(404, "Deployment not found");
    res.json(updated);
  })
);

deploymentsRouter.post(
  "/clients/:slug/rollback",
  requireAuth,
  requirePermission("rollback_deployment"),
  asyncHandler(async (req, res) => {
    const { deploymentId, reason } = z
      .object({ deploymentId: z.number().int(), reason: z.string().min(1) })
      .parse(req.body);
    const auth = req.auth!;
    const [target] = await db.select().from(deployments).where(eq(deployments.id, deploymentId)).limit(1);
    if (!target) throw new HttpError(404, "Deployment snapshot not found");

    const [rollback] = await db
      .insert(deployments)
      .values({
        clientId: target.clientId,
        pushedBy: auth.sub,
        status: "rolled_back",
        notes: `Rollback to deployment #${target.id}: ${reason}`,
        snapshotPath: target.snapshotPath,
      })
      .returning();

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "rollback_deployment",
      entityType: "deployment",
      entityId: rollback!.id,
      previousValue: { snapshotPath: target.snapshotPath, reason },
      ipAddress: req.ip ?? null,
    });
    res.json(rollback);
  })
);
