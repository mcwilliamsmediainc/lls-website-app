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
  contentPages,
  llsBrainInjectionResponses,
  photos,
  type ClientStage,
} from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { requireWorker } from "../middleware/worker.js";
import { jobDispatchLimiter } from "../middleware/rateLimit.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { writeAudit } from "../lib/audit.js";
import { STAGE_CHECKLISTS, expandDynamicItems } from "../lib/checklistTemplates.js";
import { workspaceKey, putFile, getFileText, listFiles, presignDownload } from "../lib/spaces.js";
import { parseBuildInputs, buildPagePlan, enqueueClientJob } from "../lib/orchestrator.js";

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
  notes: z.string().nullable().optional(),
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
  stage: z.enum(["intake", "mockup", "content", "review", "live"]),
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

const buildContentSchema = z.object({
  services: z.array(z.string()).optional(),
  serviceAreas: z.array(z.string()).optional(),
});

/**
 * Content-phase orchestrator: fan out generate_page jobs for the whole site.
 * Requires the client to be in the Content stage with every intake checklist
 * item resolved. Services/cities are read from client-facts.md (override via
 * the request body). Pre-creates content_pages rows (status=pending) so the
 * "all approved" gate that auto-queues internal_linking/redirect_map is
 * well-defined. Schema generation is chained per page on gate pass.
 */
clientsRouter.post(
  "/:slug/build-content",
  requireAuth,
  requirePermission("queue_job"),
  jobDispatchLimiter,
  asyncHandler(async (req, res) => {
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");
    const auth = req.auth!;

    if (client.stage !== "content") {
      throw new HttpError(409, "Client must be in the Content stage to start a content build");
    }

    // Mockup gate: the design mockup must be approved before any page is generated.
    if (!client.mockupApproved) {
      throw new HttpError(409, "Cannot start content build: the mockup has not been approved");
    }

    const intake = await db
      .select()
      .from(checklistItems)
      .where(
        and(
          eq(checklistItems.clientId, client.id),
          eq(checklistItems.stage, "intake"),
          isNull(checklistItems.deletedAt)
        )
      );
    if (!intake.length) throw new HttpError(409, "No intake checklist exists for this client");
    const open = intake.filter((i) => i.status !== "complete" && i.status !== "skipped");
    if (open.length) {
      throw new HttpError(409, `Cannot start content build: ${open.length} intake checklist item(s) still open`);
    }

    const body = buildContentSchema.parse(req.body ?? {});
    let facts = "";
    try {
      facts = await getFileText(workspaceKey(client.slug, "client-facts.md"));
    } catch {
      facts = "";
    }
    const parsed = parseBuildInputs(facts);
    const services = body.services?.length ? body.services : parsed.services;
    const serviceAreas = body.serviceAreas?.length ? body.serviceAreas : parsed.serviceAreas;
    if (!services.length && !serviceAreas.length) {
      throw new HttpError(
        422,
        "Could not determine services or service areas from client-facts.md; pass `services` and `serviceAreas` in the request body"
      );
    }

    const plan = buildPagePlan(services, serviceAreas);
    const queued: Array<{ jobId: number; slug: string; pageType: string }> = [];
    for (const page of plan) {
      // Pre-create the page target so the all-approved gate counts the full set.
      await db
        .insert(contentPages)
        .values({ clientId: client.id, pageType: page.pageType, slug: page.slug, title: page.title, status: "pending" })
        .onConflictDoNothing();
      const job = await enqueueClientJob({
        clientId: client.id,
        clientSlug: client.slug,
        taskType: "generate_page",
        params: page.params,
        queuedBy: auth.sub,
      });
      queued.push({ jobId: job.id, slug: page.slug, pageType: page.pageType });
    }

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "start_content_build",
      entityType: "client",
      entityId: client.id,
      newValue: { pages: plan.length, services, serviceAreas },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json({ ok: true, pages: plan.length, services, serviceAreas, queued });
  })
);

/* ---- mockup stage (upload / approve / worker read) ---- */

const MOCKUP_ALLOWED = /\.(html?|png|jpe?g|webp|gif|svg|pdf)$/i;

/** Map a mockup filename to a sensible content type for storage + display. */
function mockupContentType(filename: string): string {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const map: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

const mockupUploadSchema = z.object({
  filename: z.string().min(1),
  content: z.string(),
  /** utf8 for HTML/SVG text; base64 for binary images / PDFs. */
  encoding: z.enum(["utf8", "base64"]).default("base64"),
  contentType: z.string().optional(),
});

/**
 * Upload (or replace) the design mockup for a client. Stores the file under
 * workspace/<slug>/mockups/ and records it on the client. A new upload resets
 * the approval flag — a replaced mockup must be re-approved before content can be
 * built. Marks the "Mockup uploaded" checklist item complete when present.
 */
clientsRouter.post(
  "/:slug/mockup",
  requireAuth,
  requirePermission("add_edit_client"),
  asyncHandler(async (req, res) => {
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");
    const auth = req.auth!;
    const body = mockupUploadSchema.parse(req.body);

    // Reject path traversal: store by basename only.
    const filename = body.filename.replace(/^.*[\\/]/, "");
    if (!MOCKUP_ALLOWED.test(filename)) {
      throw new HttpError(422, "Mockup must be an HTML, image (png/jpg/webp/gif/svg), or PDF file");
    }

    const key = workspaceKey(client.slug, `mockups/${filename}`);
    const data = body.encoding === "base64" ? Buffer.from(body.content, "base64") : body.content;
    await putFile(key, data, body.contentType ?? mockupContentType(filename));

    const [updated] = await db
      .update(clients)
      .set({ mockupFilePath: key, mockupApproved: false })
      .where(eq(clients.id, client.id))
      .returning();

    // Best-effort: mark the upload checklist item complete.
    await db
      .update(checklistItems)
      .set({ status: "complete", completedAt: new Date() })
      .where(
        and(
          eq(checklistItems.clientId, client.id),
          eq(checklistItems.stage, "mockup"),
          eq(checklistItems.itemName, "Mockup uploaded")
        )
      );

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "upload_mockup",
      entityType: "client",
      entityId: client.id,
      newValue: { mockupFilePath: key },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json({ ok: true, client: updated, key });
  })
);

const mockupApproveSchema = z.object({ approved: z.boolean().default(true) });

/** Approve (or un-approve) the uploaded mockup. Approval is the gate for the
 * content build. Requires a mockup to have been uploaded first. */
clientsRouter.post(
  "/:slug/mockup/approve",
  requireAuth,
  requirePermission("approve_content"),
  asyncHandler(async (req, res) => {
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");
    const auth = req.auth!;
    const { approved } = mockupApproveSchema.parse(req.body ?? {});

    if (approved && !client.mockupFilePath) {
      throw new HttpError(409, "Cannot approve: no mockup has been uploaded");
    }

    const [updated] = await db
      .update(clients)
      .set({ mockupApproved: approved })
      .where(eq(clients.id, client.id))
      .returning();

    if (approved) {
      await db
        .update(checklistItems)
        .set({ status: "complete", completedAt: new Date() })
        .where(
          and(
            eq(checklistItems.clientId, client.id),
            eq(checklistItems.stage, "mockup"),
            eq(checklistItems.itemName, "Mockup approved by client")
          )
        );
    }

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: approved ? "approve_mockup" : "unapprove_mockup",
      entityType: "client",
      entityId: client.id,
      newValue: { mockupApproved: approved },
      ipAddress: req.ip ?? null,
    });

    res.json({ ok: true, client: updated });
  })
);

/**
 * Worker read: the mockup as a layout reference for generate_page. Returns the
 * extracted text for HTML/SVG mockups, or a structured description for binary
 * (image/PDF) mockups that cannot be inlined as text.
 */
clientsRouter.get(
  "/:slug/mockup/content",
  requireWorker,
  asyncHandler(async (req, res) => {
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");

    if (!client.mockupFilePath) {
      res.json({ hasMockup: false, approved: false, isText: false, content: "" });
      return;
    }

    const filename = client.mockupFilePath.replace(/^.*\//, "");
    const isText = /\.(html?|svg)$/i.test(filename);
    let content = "";
    if (isText) {
      try {
        const raw = await getFileText(client.mockupFilePath);
        // Cap to keep the prompt within budget; the layout structure is in the markup.
        content = raw.length > 16000 ? `${raw.slice(0, 16000)}\n<!-- mockup truncated -->` : raw;
      } catch {
        content = "";
      }
    } else {
      content = `Binary design mockup on file: ${filename}. Use it as the visual layout reference: match the section order, content hierarchy, and component structure the design implies.`;
    }

    res.json({
      hasMockup: true,
      approved: client.mockupApproved,
      filePath: client.mockupFilePath,
      isText,
      content,
    });
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

/** Worker read: the url-inventory.csv (workspace/<slug>/url-inventory.csv) for redirect_map. */
clientsRouter.get(
  "/:slug/inventory",
  requireWorker,
  asyncHandler(async (req, res) => {
    let inventoryCsv = "";
    try {
      inventoryCsv = await getFileText(workspaceKey(req.params.slug, "url-inventory.csv"));
    } catch {
      inventoryCsv = "";
    }
    res.json({ inventoryCsv });
  })
);

/**
 * Worker callback: write a generated file to the client workspace (spec Table 10).
 * Text files are sent as a UTF-8 string; binary files (e.g. harvested images) are
 * sent base64-encoded with `encoding: "base64"` and decoded back to bytes here.
 */
clientsRouter.post(
  "/:slug/files",
  requireWorker,
  asyncHandler(async (req, res) => {
    const { filename, content, contentType, encoding } = z
      .object({
        filename: z.string().min(1),
        content: z.string(),
        contentType: z.string().optional(),
        encoding: z.enum(["utf8", "base64"]).default("utf8"),
      })
      .parse(req.body);
    const key = workspaceKey(req.params.slug, filename);
    const body = encoding === "base64" ? Buffer.from(content, "base64") : content;
    await putFile(key, body, contentType ?? "text/markdown");
    res.json({ ok: true, key });
  })
);

/**
 * Worker callback: register a harvested/generated photo record (image_harvest
 * handler). Mirrors the authenticated photo-register route but is worker-authed
 * and drives the Photo Manager image hierarchy. Distinct path from the
 * authenticated POST /:slug/photos (photosRouter) so worker auth does not shadow
 * the team-facing register endpoint.
 */
clientsRouter.post(
  "/:slug/photos/harvest",
  requireWorker,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        filename: z.string().min(1),
        source: z.enum(["client", "gbp", "ai_generated", "licensed_stock"]).default("client"),
        category: z.string().optional(),
        zoneType: z.string().optional(),
        pageAssigned: z.string().optional(),
        altText: z.string().optional(),
        generationMetadata: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    const client = await getClientBySlug(req.params.slug);
    if (!client) throw new HttpError(404, "Client not found");

    // Idempotent on re-run: skip if a non-deleted photo with this filename exists.
    const dupe = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.clientId, client.id), eq(photos.filename, body.filename), isNull(photos.deletedAt)))
      .limit(1);
    if (dupe.length) {
      res.json({ ok: true, id: dupe[0]!.id, deduped: true });
      return;
    }

    const [photo] = await db
      .insert(photos)
      .values({
        clientId: client.id,
        filename: body.filename,
        source: body.source,
        category: body.category,
        zoneType: body.zoneType,
        pageAssigned: body.pageAssigned,
        altText: body.altText,
        generationMetadata: body.generationMetadata ?? {},
      })
      .returning();
    res.status(201).json({ ok: true, id: photo!.id });
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
