/**
 * Photo routes (Photo Manager). List a client's photos grouped by harvest
 * category with presigned thumbnail URLs, register new photo records, recategorize
 * / retag them, soft-delete them, and assign a photo to a specific page zone.
 *
 * Image hierarchy (L40-22): client photos first, then GBP, then AI generation,
 * then licensed stock. The image_harvest handler deposits client imagery into
 * MinIO/Spaces under workspace/<slug>/images/harvested/ and registers a photos
 * row per image (source=client) with a `category` classification.
 *
 * Field model:
 *   category   — durable harvest classification (hero/team/office/service/...),
 *                what the UI groups + filters on.
 *   zoneType   — the page-zone slot the photo has been assigned to (hero/featured/
 *                sidebar/gallery/logo). Written by the assign endpoint.
 *   pageAssigned — the page slug the photo is placed on.
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq, isNull, desc } from "drizzle-orm";
import { db, clients, photos, jobs } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { writeAudit } from "../lib/audit.js";
import { presignDownload, workspaceKey } from "../lib/spaces.js";
import { enqueueJob } from "../lib/queue.js";

export const photosRouter = Router();

/** The harvest categories the Photo Manager groups + filters on. */
export const PHOTO_CATEGORIES = [
  "hero",
  "team",
  "office",
  "service",
  "location",
  "logo",
  "other",
] as const;
type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

/** Resolve the Spaces/MinIO object key for a photo record. Harvested images carry
 * their stored_path in generation_metadata; fall back to the harvested convention. */
function objectKey(slug: string, filename: string, meta: Record<string, unknown>): string {
  const stored = meta?.stored_path;
  if (typeof stored === "string" && stored.length > 0) return stored;
  return workspaceKey(slug, `images/harvested/${filename}`);
}

function normalizeCategory(value: string | null): PhotoCategory {
  return (PHOTO_CATEGORIES as readonly string[]).includes(value ?? "")
    ? (value as PhotoCategory)
    : "other";
}

async function getClientOr404(slug: string) {
  const [client] = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
  if (!client) throw new HttpError(404, "Client not found");
  return client;
}

/**
 * GET /:slug/photos — all of a client's photos, grouped by category, each with a
 * presigned thumbnail URL the frontend can render directly.
 */
photosRouter.get(
  "/:slug/photos",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const client = await getClientOr404(req.params.slug);
    const rows = await db
      .select()
      .from(photos)
      .where(and(eq(photos.clientId, client.id), isNull(photos.deletedAt)))
      .orderBy(desc(photos.uploadedAt));

    const enriched = await Promise.all(
      rows.map(async (p) => {
        const category = normalizeCategory(p.category);
        let url: string | null = null;
        try {
          url = await presignDownload(objectKey(client.slug, p.filename, p.generationMetadata), 3600);
        } catch {
          url = null;
        }
        return {
          id: p.id,
          filename: p.filename,
          source: p.source,
          category,
          zoneType: p.zoneType,
          pageAssigned: p.pageAssigned,
          altText: p.altText,
          licenseId: p.licenseId,
          optimized: p.optimized,
          url,
        };
      })
    );

    // Group into the fixed category buckets (empty arrays for absent categories).
    const groups: Record<PhotoCategory, typeof enriched> = {
      hero: [],
      team: [],
      office: [],
      service: [],
      location: [],
      logo: [],
      other: [],
    };
    for (const p of enriched) groups[p.category].push(p);

    res.json({
      categories: PHOTO_CATEGORIES,
      total: enriched.length,
      groups,
      photos: enriched,
    });
  })
);

const registerSchema = z.object({
  filename: z.string().min(1),
  source: z.enum(["client", "gbp", "ai_generated", "licensed_stock"]),
  category: z.enum(PHOTO_CATEGORIES).optional(),
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
    const client = await getClientOr404(req.params.slug);
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

/**
 * PATCH /:slug/photos/:id — recategorize / retag a photo. All authenticated roles
 * may update (spec: photo curation is not role-gated).
 */
const patchSchema = z
  .object({
    category: z.enum(PHOTO_CATEGORIES).optional(),
    zoneType: z.string().nullable().optional(),
    pageAssigned: z.string().nullable().optional(),
  })
  .refine((b) => b.category !== undefined || b.zoneType !== undefined || b.pageAssigned !== undefined, {
    message: "Provide at least one of: category, zoneType, pageAssigned",
  });

photosRouter.patch(
  "/:slug/photos/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const client = await getClientOr404(req.params.slug);
    const id = z.coerce.number().int().parse(req.params.id);
    const body = patchSchema.parse(req.body);
    const auth = req.auth!;

    const [existing] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.clientId, client.id), isNull(photos.deletedAt)))
      .limit(1);
    if (!existing) throw new HttpError(404, "Photo not found");

    const set: Partial<typeof photos.$inferInsert> = {};
    if (body.category !== undefined) set.category = body.category;
    if (body.zoneType !== undefined) set.zoneType = body.zoneType;
    if (body.pageAssigned !== undefined) set.pageAssigned = body.pageAssigned;

    const [updated] = await db.update(photos).set(set).where(eq(photos.id, id)).returning();
    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "update_photo",
      entityType: "photo",
      entityId: id,
      previousValue: { category: existing.category, zoneType: existing.zoneType, pageAssigned: existing.pageAssigned },
      newValue: set,
      ipAddress: req.ip ?? null,
    });
    res.json(updated);
  })
);

/**
 * DELETE /:slug/photos/:id — soft delete (sets deleted_at). Matt/Tyler only.
 */
photosRouter.delete(
  "/:slug/photos/:id",
  requireAuth,
  requirePermission("delete_client"),
  asyncHandler(async (req, res) => {
    const client = await getClientOr404(req.params.slug);
    const id = z.coerce.number().int().parse(req.params.id);
    const auth = req.auth!;

    const [existing] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.clientId, client.id), isNull(photos.deletedAt)))
      .limit(1);
    if (!existing) throw new HttpError(404, "Photo not found");

    await db
      .update(photos)
      .set({ deletedAt: new Date(), deletedBy: auth.sub })
      .where(eq(photos.id, id));
    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "delete_photo",
      entityType: "photo",
      entityId: id,
      previousValue: { filename: existing.filename },
      ipAddress: req.ip ?? null,
    });
    res.status(204).end();
  })
);

/**
 * POST /:slug/photos/:id/assign — place a photo in a page zone. Updates
 * page_assigned + zone_type immediately, then enqueues a wp_image_assign worker
 * job so the staging WordPress featured-image / theme-mod is updated over SSH.
 * The DB record is the source of truth; the WP sync is best-effort and async.
 */
const assignSchema = z.object({
  page_slug: z.string().min(1),
  zone: z.string().min(1),
});

photosRouter.post(
  "/:slug/photos/:id/assign",
  requireAuth,
  asyncHandler(async (req, res) => {
    const client = await getClientOr404(req.params.slug);
    const id = z.coerce.number().int().parse(req.params.id);
    const { page_slug, zone } = assignSchema.parse(req.body);
    const auth = req.auth!;

    const [existing] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.clientId, client.id), isNull(photos.deletedAt)))
      .limit(1);
    if (!existing) throw new HttpError(404, "Photo not found");

    const [updated] = await db
      .update(photos)
      .set({ pageAssigned: page_slug, zoneType: zone })
      .where(eq(photos.id, id))
      .returning();

    // Trigger the staging WordPress update via a worker job (SSH + WP-CLI).
    let wpSync: { queued: boolean; jobId?: number; reason?: string } = { queued: false };
    if (!client.managedHosting || !client.serverHost) {
      wpSync = { queued: false, reason: "client not managed-hosting; WP sync skipped" };
    } else {
      try {
        const [job] = await db
          .insert(jobs)
          .values({
            clientId: client.id,
            taskType: "wp_image_assign",
            status: "queued",
            queuedBy: auth.sub,
            payload: {
              photoId: updated!.id,
              filename: updated!.filename,
              pageSlug: page_slug,
              zone,
              storedPath: (updated!.generationMetadata as Record<string, unknown>)?.stored_path ?? null,
              wpMediaId: (updated!.generationMetadata as Record<string, unknown>)?.wp_media_id ?? null,
            },
          })
          .returning();
        if (job) {
          await enqueueJob({
            jobId: job.id,
            clientId: client.id,
            clientSlug: client.slug,
            taskType: "wp_image_assign",
            params: {
              photoId: updated!.id,
              filename: updated!.filename,
              pageSlug: page_slug,
              zone,
              storedPath: (updated!.generationMetadata as Record<string, unknown>)?.stored_path ?? null,
              wpMediaId: (updated!.generationMetadata as Record<string, unknown>)?.wp_media_id ?? null,
            },
          });
          wpSync = { queued: true, jobId: job.id };
        }
      } catch (err) {
        // Never fail the assignment because the WP sync could not be queued.
        wpSync = { queued: false, reason: err instanceof Error ? err.message : String(err) };
      }
    }

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "assign_photo",
      entityType: "photo",
      entityId: id,
      newValue: { pageSlug: page_slug, zone, wpJobId: wpSync.jobId ?? null },
      ipAddress: req.ip ?? null,
    });

    res.json({ photo: updated, wpSync });
  })
);
