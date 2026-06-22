/**
 * Checklist routes for the team UI: list a client's items and update item status.
 * (Worker-driven completion lives on /api/clients/:slug/checklist.)
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { db, clients, checklistItems } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { writeAudit } from "../lib/audit.js";

export const checklistRouter = Router();

checklistRouter.get(
  "/:slug/checklist",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const [client] = await db.select().from(clients).where(eq(clients.slug, req.params.slug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");
    const rows = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.clientId, client.id))
      .orderBy(asc(checklistItems.stage), asc(checklistItems.sortOrder));
    res.json(rows);
  })
);

const patchSchema = z.object({
  status: z.enum(["pending", "in_progress", "complete", "blocked", "skipped"]),
  notes: z.string().optional(),
  assignedTo: z.number().int().nullable().optional(),
});

checklistRouter.patch(
  "/:slug/checklist/:itemId",
  requireAuth,
  requirePermission("queue_job"),
  asyncHandler(async (req, res) => {
    const itemId = z.coerce.number().int().parse(req.params.itemId);
    const patch = patchSchema.parse(req.body);
    const auth = req.auth!;

    const [item] = await db.select().from(checklistItems).where(eq(checklistItems.id, itemId)).limit(1);
    if (!item) throw new HttpError(404, "Checklist item not found");

    const [updated] = await db
      .update(checklistItems)
      .set({
        status: patch.status,
        notes: patch.notes ?? item.notes,
        assignedTo: patch.assignedTo === undefined ? item.assignedTo : patch.assignedTo,
        completedAt: patch.status === "complete" ? new Date() : null,
      })
      .where(eq(checklistItems.id, itemId))
      .returning();

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "checklist_update",
      entityType: "checklist_item",
      entityId: itemId,
      previousValue: { status: item.status },
      newValue: { status: patch.status },
      ipAddress: req.ip ?? null,
    });
    res.json(updated);
  })
);
