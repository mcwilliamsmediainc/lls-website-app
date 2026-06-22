/**
 * Content page routes: list, approve/reject, resolve [VERIFY] flags, and a worker
 * upsert callback.
 *
 * Gate rule (spec Table 25): no one can approve a page whose automated style gate
 * has failed, and all [VERIFY] flags must be resolved before approval.
 */

import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, clients, contentPages, jobs } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { requireWorker } from "../middleware/worker.js";
import { jobDispatchLimiter } from "../middleware/rateLimit.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { writeAudit } from "../lib/audit.js";
import { chainSchemaForPage, chainLinkingAndRedirect, enqueueClientJob } from "../lib/orchestrator.js";

export const contentRouter = Router();

contentRouter.get(
  "/clients/:slug/content",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const [client] = await db.select().from(clients).where(eq(clients.slug, req.params.slug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");
    const rows = await db.select().from(contentPages).where(eq(contentPages.clientId, client.id));
    res.json(rows);
  })
);

contentRouter.post(
  "/content/:id/approve",
  requireAuth,
  requirePermission("approve_content"),
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const auth = req.auth!;
    const [page] = await db.select().from(contentPages).where(eq(contentPages.id, id)).limit(1);
    if (!page) throw new HttpError(404, "Content page not found");

    if (page.gateStatus !== "passing") {
      throw new HttpError(409, "Cannot approve: style gate has not passed for this page");
    }
    if (page.verifyFlagsResolved < page.verifyFlagsCount) {
      throw new HttpError(409, "Cannot approve: unresolved [VERIFY] flags remain");
    }

    const [updated] = await db
      .update(contentPages)
      .set({ status: "approved", approvedBy: auth.sub, approvedAt: new Date() })
      .where(eq(contentPages.id, id))
      .returning();

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "approve_content",
      entityType: "content_page",
      entityId: id,
      ipAddress: req.ip ?? null,
    });

    // Auto-queue internal_linking + redirect_map once every page is approved.
    const [client] = await db.select().from(clients).where(eq(clients.id, page.clientId)).limit(1);
    if (client) await chainLinkingAndRedirect(page.clientId, client.slug, auth.sub);

    res.json(updated);
  })
);

contentRouter.post(
  "/content/:id/reject",
  requireAuth,
  requirePermission("approve_content"),
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const auth = req.auth!;
    const [updated] = await db
      .update(contentPages)
      .set({ status: "rejected" })
      .where(eq(contentPages.id, id))
      .returning();
    if (!updated) throw new HttpError(404, "Content page not found");
    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "reject_content",
      entityType: "content_page",
      entityId: id,
      newValue: { reason: reason ?? null },
      ipAddress: req.ip ?? null,
    });
    res.json(updated);
  })
);

/**
 * Re-queue generate_page for a page whose generation failed (gate failure or a
 * hard job failure). Reuses the most recent generate_page payload for this page
 * so service/city params match the original; falls back to reconstructing them
 * from the page row. Resets the page to a regenerating state.
 */
contentRouter.post(
  "/content/:id/retry",
  requireAuth,
  requirePermission("queue_job"),
  jobDispatchLimiter,
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const auth = req.auth!;
    const [page] = await db.select().from(contentPages).where(eq(contentPages.id, id)).limit(1);
    if (!page) throw new HttpError(404, "Content page not found");
    const [client] = await db.select().from(clients).where(eq(clients.id, page.clientId)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");

    const [prior] = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.clientId, page.clientId),
          eq(jobs.taskType, "generate_page"),
          sql`${jobs.payload} ->> 'slug' = ${page.slug}`
        )
      )
      .orderBy(desc(jobs.queuedAt))
      .limit(1);

    let params: Record<string, unknown>;
    if (prior && prior.payload && Object.keys(prior.payload).length > 0) {
      params = prior.payload as Record<string, unknown>;
    } else {
      params = { pageType: page.pageType, slug: page.slug, title: page.title ?? page.slug };
      if (page.pageType === "location") params.city = page.title ?? page.slug;
      if (page.pageType === "service") params.service = (page.title ?? page.slug).replace(/^Service:\s*/i, "");
    }

    await db
      .update(contentPages)
      .set({ status: "generating", gateStatus: "pending", gateFailureReason: null })
      .where(eq(contentPages.id, id));

    const job = await enqueueClientJob({
      clientId: page.clientId,
      clientSlug: client.slug,
      taskType: "generate_page",
      params,
      queuedBy: auth.sub,
    });

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "retry_generate_page",
      entityType: "content_page",
      entityId: id,
      newValue: { jobId: job.id, slug: page.slug },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json({ ok: true, jobId: job.id });
  })
);

/** Resolve N [VERIFY] flags on a page (Penn's workflow). */
contentRouter.post(
  "/content/:id/resolve-flags",
  requireAuth,
  requirePermission("approve_content"),
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { resolved } = z.object({ resolved: z.number().int().min(0) }).parse(req.body);
    const [page] = await db.select().from(contentPages).where(eq(contentPages.id, id)).limit(1);
    if (!page) throw new HttpError(404, "Content page not found");
    const capped = Math.min(resolved, page.verifyFlagsCount);
    const [updated] = await db
      .update(contentPages)
      .set({ verifyFlagsResolved: capped })
      .where(eq(contentPages.id, id))
      .returning();
    res.json(updated);
  })
);

/** True when every (non-deleted) content page for a client is approved.
 * Gates the internal_linking job (spec Table 26). */
contentRouter.get(
  "/clients/:slug/content/all-approved",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const [client] = await db.select().from(clients).where(eq(clients.slug, req.params.slug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");
    const rows = await db.select().from(contentPages).where(eq(contentPages.clientId, client.id));
    const relevant = rows.filter((r) => !r.deletedAt);
    const allApproved = relevant.length > 0 && relevant.every((r) => r.status === "approved");
    res.json({ allApproved, total: relevant.length });
  })
);

/** Worker callback: flag that schema has been generated for a page (no other fields touched). */
contentRouter.post(
  "/content/mark-schema",
  requireWorker,
  asyncHandler(async (req, res) => {
    const { clientSlug, slug } = z.object({ clientSlug: z.string(), slug: z.string() }).parse(req.body);
    const [client] = await db.select().from(clients).where(eq(clients.slug, clientSlug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");
    const [updated] = await db
      .update(contentPages)
      .set({ schemaGenerated: true })
      .where(and(eq(contentPages.clientId, client.id), eq(contentPages.slug, slug)))
      .returning();
    if (!updated) throw new HttpError(404, "Content page not found for schema mark");
    res.json(updated);
  })
);

/** Worker upsert of a generated content page record (sets gate + flag fields). */
const upsertSchema = z.object({
  clientSlug: z.string(),
  pageType: z.string(),
  slug: z.string(),
  title: z.string().optional(),
  wordCount: z.number().int().default(0),
  verifyFlagsCount: z.number().int().default(0),
  gateStatus: z.enum(["pending", "passing", "failed"]).default("pending"),
  gateFailureReason: z.string().nullable().optional(),
  schemaGenerated: z.boolean().optional(),
});

contentRouter.post(
  "/content/upsert",
  requireWorker,
  asyncHandler(async (req, res) => {
    const u = upsertSchema.parse(req.body);
    const [client] = await db.select().from(clients).where(eq(clients.slug, u.clientSlug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");

    const [existing] = await db
      .select()
      .from(contentPages)
      .where(and(eq(contentPages.clientId, client.id), eq(contentPages.slug, u.slug)))
      .limit(1);

    const values = {
      clientId: client.id,
      pageType: u.pageType,
      slug: u.slug,
      title: u.title,
      status: "generated" as const,
      wordCount: u.wordCount,
      generatedAt: new Date(),
      verifyFlagsCount: u.verifyFlagsCount,
      gateStatus: u.gateStatus,
      gateFailureReason: u.gateFailureReason ?? null,
      schemaGenerated: u.schemaGenerated ?? existing?.schemaGenerated ?? false,
    };

    if (existing) {
      const [updated] = await db
        .update(contentPages)
        .set({
          ...values,
          previousContentMd: existing.previousContentMd,
          previousStatus: existing.status,
        })
        .where(eq(contentPages.id, existing.id))
        .returning();
      if (updated) {
        await chainSchemaForPage(client.id, u.clientSlug, {
          slug: updated.slug,
          pageType: updated.pageType,
          gateStatus: updated.gateStatus,
          schemaGenerated: updated.schemaGenerated,
        });
      }
      res.json(updated);
      return;
    }
    const [created] = await db.insert(contentPages).values(values).returning();
    if (created) {
      await chainSchemaForPage(client.id, u.clientSlug, {
        slug: created.slug,
        pageType: created.pageType,
        gateStatus: created.gateStatus,
        schemaGenerated: created.schemaGenerated,
      });
    }
    res.status(201).json(created);
  })
);
