/**
 * Client routes: CRUD, stage transitions (auto-create stage checklists),
 * client-facts brief, and worker callbacks for file writes + checklist updates.
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq, isNull, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  db,
  clients,
  checklistItems,
  llsBrainInjectionResponses,
  type ClientStage,
} from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { requireWorker } from "../middleware/worker.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { writeAudit } from "../lib/audit.js";
import { STAGE_CHECKLISTS, expandDynamicItems } from "../lib/checklistTemplates.js";
import { workspaceKey, putFile, getFileText, listFiles, presignDownload } from "../lib/spaces.js";

export const clientsRouter = Router();

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createSchema = z.object({
  slug: z.string().regex(slugRe, "slug must be kebab-case"),
  businessName: z.string().min(1),
  siteUrl: z.string().url().optional(),
  siteType: z.enum(["home_services", "dental_health", "legal", "other"]).default("home_services"),
  tier: z.enum(["tier_1", "tier_2", "tier_3"]).optional(),
  assignedTo: z.number().int().optional(),
  serviceAreas: z.array(z.string()).default([]),
  primaryServices: z.array(z.string()).default([]),
});

async function createStageChecklist(
  clientId: number,
  stage: ClientStage,
  opts: { cities?: string[]; services?: string[] } = {}
): Promise<void> {
  const items = expandDynamicItems(STAGE_CHECKLISTS[stage], opts);
  if (!items.length) return;
  await db.insert(checklistItems).values(
    items.map((it, idx) => ({
      clientId,
      stage,
      itemName: it.itemName,
      sortOrder: idx,
    }))
  );
}

/** List all clients (soft-deleted excluded). */
clientsRouter.get(
  "/",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(desc(clients.createdAt));
    res.json(rows);
  })
);

/** Create a client and auto-create the intake checklist + a Brain Injection token. */
clientsRouter.post(
  "/",
  requireAuth,
  requirePermission("add_edit_client"),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const auth = req.auth!;

    const existing = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, body.slug)).limit(1);
    if (existing.length) throw new HttpError(409, `A client with slug '${body.slug}' already exists`);

    const stagingUrl = `${body.slug}.staging.locallaunchsystem.com`;

    const [client] = await db
      .insert(clients)
      .values({
        slug: body.slug,
        businessName: body.businessName,
        siteUrl: body.siteUrl,
        siteType: body.siteType,
        tier: body.tier,
        assignedTo: body.assignedTo,
        stage: "intake",
        stagingUrl,
      })
      .returning();
    if (!client) throw new HttpError(500, "Failed to create client");

    await createStageChecklist(client.id, "intake", {
      cities: body.serviceAreas,
      services: body.primaryServices,
    });

    // Generate a Brain Injection response token for the onboarding link.
    const responseToken = randomBytes(24).toString("hex");
    await db.insert(llsBrainInjectionResponses).values({
      clientId: client.id,
      responseToken,
      status: "pending",
    });

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "create_client",
      entityType: "client",
      entityId: client.id,
      newValue: { slug: client.slug, businessName: client.businessName },
      ipAddress: req.ip ?? null,
      userAgent: req.header("user-agent") ?? null,
    });

    res.status(201).json({ client, brainInjectionToken: responseToken });
  })
);

async function getClientBySlug(slug: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.slug, slug), isNull(clients.deletedAt)))
    .limit(1);
  return client ?? null;
}

/** Get a single client. */
clientsRouter.get(
  "/:slug",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");
    res.json(client);
  })
);

const updateSchema = z.object({
  businessName: z.string().min(1).optional(),
  siteUrl: z.string().url().nullable().optional(),
  siteType: z.enum(["home_services", "dental_health", "legal", "other"]).optional(),
  tier: z.enum(["tier_1", "tier_2", "tier_3"]).nullable().optional(),
  assignedTo: z.number().int().nullable().optional(),
  liveUrl: z.string().url().nullable().optional(),
  rankMapVerdict: z.string().nullable().optional(),
  phaseUnlocked: z.number().int().min(1).max(5).optional(),
});

clientsRouter.patch(
  "/:slug",
  requireAuth,
  requirePermission("add_edit_client"),
  asyncHandler(async (req, res) => {
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");
    const patch = updateSchema.parse(req.body);
    const auth = req.auth!;

    const [updated] = await db.update(clients).set(patch).where(eq(clients.id, client.id)).returning();
    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "update_client",
      entityType: "client",
      entityId: client.id,
      previousValue: client as unknown as Record<string, unknown>,
      newValue: patch,
      ipAddress: req.ip ?? null,
    });
    res.json(updated);
  })
);

const stageSchema = z.object({
  stage: z.enum(["intake", "content", "review", "live"]),
  serviceAreas: z.array(z.string()).default([]),
  primaryServices: z.array(z.string()).default([]),
});

/** Move a client to a new stage; auto-create that stage's checklist if absent. */
clientsRouter.post(
  "/:slug/stage",
  requireAuth,
  requirePermission("add_edit_client"),
  asyncHandler(async (req, res) => {
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");
    const { stage, serviceAreas, primaryServices } = stageSchema.parse(req.body);
    const auth = req.auth!;

    const existing = await db
      .select({ id: checklistItems.id })
      .from(checklistItems)
      .where(and(eq(checklistItems.clientId, client.id), eq(checklistItems.stage, stage)))
      .limit(1);
    if (!existing.length) {
      await createStageChecklist(client.id, stage, { cities: serviceAreas, services: primaryServices });
    }

    const set: Record<string, unknown> = { stage };
    if (stage === "live") set.launchedAt = new Date();
    const [updated] = await db.update(clients).set(set).where(eq(clients.id, client.id)).returning();

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "client_stage_change",
      entityType: "client",
      entityId: client.id,
      previousValue: { stage: client.stage },
      newValue: { stage },
      ipAddress: req.ip ?? null,
    });
    res.json(updated);
  })
);

/** Soft delete a client. */
clientsRouter.delete(
  "/:slug",
  requireAuth,
  requirePermission("delete_client"),
  asyncHandler(async (req, res) => {
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");
    const auth = req.auth!;
    await db
      .update(clients)
      .set({ deletedAt: new Date(), deletedBy: auth.sub })
      .where(eq(clients.id, client.id));
    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "delete_client",
      entityType: "client",
      entityId: client.id,
      ipAddress: req.ip ?? null,
    });
    res.json({ ok: true });
  })
);

/* ---- client-facts brief (GET /api/clients/:slug/brief) ---- */

clientsRouter.get(
  "/:slug/brief",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");
    let content = "";
    try {
      content = await getFileText(workspaceKey(client.slug, "client-facts.md"));
    } catch {
      content = "";
    }
    res.json({ slug: client.slug, clientFacts: content });
  })
);

/* ---- file browser ---- */

clientsRouter.get(
  "/:slug/files",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");
    const files = await listFiles(`workspace/${client.slug}/`);
    res.json(files);
  })
);

clientsRouter.get(
  "/:slug/files/download",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const key = z.string().parse(req.query.key);
    if (!key.startsWith(`workspace/${req.params.slug}/`)) {
      throw new HttpError(400, "key must be within this client's workspace");
    }
    const url = await presignDownload(key);
    res.json({ url });
  })
);

/** Worker read: client-facts.md for building job context (worker-authed). */
clientsRouter.get(
  "/:slug/facts",
  requireWorker,
  asyncHandler(async (req, res) => {
    let content = "";
    try {
      content = await getFileText(workspaceKey(req.params.slug, "client-facts.md"));
    } catch {
      content = "";
    }
    res.json({ slug: req.params.slug, clientFacts: content });
  })
);

/** Worker read: all generated page markdown files (workspace/<slug>/pages/*.md). */
clientsRouter.get(
  "/:slug/pages",
  requireWorker,
  asyncHandler(async (req, res) => {
    const prefix = `workspace/${req.params.slug}/pages/`;
    const objects = await listFiles(prefix);
    const pages: Array<{ slug: string; content: string }> = [];
    for (const obj of objects) {
      if (!obj.key.endsWith(".md")) continue;
      const fileSlug = obj.key.slice(prefix.length).replace(/\.md$/, "");
      const content = await getFileText(obj.key);
      pages.push({ slug: fileSlug, content });
    }
    res.json(pages);
  })
);

/** Worker callback: write a generated file to the client workspace (spec Table 10). */
clientsRouter.post(
  "/:slug/files",
  requireWorker,
  asyncHandler(async (req, res) => {
    const { filename, content, contentType } = z
      .object({ filename: z.string().min(1), content: z.string(), contentType: z.string().optional() })
      .parse(req.body);
    const key = workspaceKey(req.params.slug, filename);
    await putFile(key, content, contentType ?? "text/markdown");
    res.json({ ok: true, key });
  })
);

/** Worker callback: mark a checklist item complete by name (spec Table 10). */
clientsRouter.post(
  "/:slug/checklist",
  requireWorker,
  asyncHandler(async (req, res) => {
    const { item, status } = z
      .object({ item: z.string().min(1), status: z.enum(["pending", "in_progress", "complete", "blocked", "skipped"]) })
      .parse(req.body);
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");

    const rows = await db
      .select()
      .from(checklistItems)
      .where(and(eq(checklistItems.clientId, client.id), eq(checklistItems.itemName, item)))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new HttpError(404, `Checklist item not found: ${item}`);

    await db
      .update(checklistItems)
      .set({ status, completedAt: status === "complete" ? new Date() : null })
      .where(eq(checklistItems.id, existing.id));
    res.json({ ok: true });
  })
);
