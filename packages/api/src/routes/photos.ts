/**
 * Photo routes (Photo Manager). List a client's photos and register photo records
 * with their source tier (client / gbp / ai_generated / licensed_stock) and zone.
 * Binary upload to DO Spaces is done via a presigned URL flow; this records the
 * metadata that drives the image hierarchy (L40-22).
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq, isNull, desc } from "drizzle-orm";
import { db, clients, photos } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { writeAudit } from "../lib/audit.js";

export const photosRouter = Router();

photosRouter.get(
  "/:slug/photos",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const [client] = await db.select().from(clients).where(eq(clients.slug, req.params.slug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");
    const rows = await db
      .select()
      .from(photos)
      .where(and(eq(photos.clientId, client.id), isNull(photos.deletedAt)))
      .orderBy(desc(photos.uploadedAt));
    res.json(rows);
  })
);

const registerSchema = z.object({
  filename: z.string().min(1),
  source: z.enum(["client", "gbp", "ai_generated", "licensed_stock"]),
  zoneType: z.string().optional(),
  pageAssigned: z.string().optional(),
  altText: z.string().optional(),
  licenseId: z.string().optional(),
});

photosRouter.post(
  "/:slug/photos",
  requireAuth,
  requirePermission("add_edit_client"),
  asyncHandler(async (req, res) => {
    const [client] = await db.select().from(clients).where(eq(clients.slug, req.params.slug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");
    const body = registerSchema.parse(req.body);
    const auth = req.auth!;
    const [photo] = await db
      .insert(photos)
      .values({ clientId: client.id, ...body })
      .returning();
    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "register_photo",
      entityType: "photo",
      entityId: photo!.id,
      ipAddress: req.ip ?? null,
    });
    res.status(201).json(photo);
  })
);
