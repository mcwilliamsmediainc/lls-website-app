/**
 * LLS Production Build Workspace — Drizzle schema
 *
 * Source of truth: LLS-Production-System-Spec-v5.3.docx Section 11 + the v5.3
 * correction tables (soft delete fields, audit log, heartbeat summary).
 *
 * Conventions:
 *  - snake_case columns, camelCase TS identifiers.
 *  - Soft delete columns (deleted_at, deleted_by) added to: clients, content_pages,
 *    wireframe_pages, change_tickets, photos, checklist_items.
 *  - jsonb columns typed with $type<...>() where the shape is known.
 */

import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ============================================================
 * Enums
 * ========================================================== */

/** Team roles. Drives the server-side permission matrix (spec Table 28). */
export const teamRoleEnum = pgEnum("team_role", [
  "matt",
  "tiffany",
  "elise",
  "chloe",
  "penn",
  "rachelle",
  "clarence",
  "tyler",
  "lindsay",
]);

/** Pipeline stages (kanban columns). Wireframe deferred to Phase 4.
 * Mockup sits between Intake and Content: a design mockup is uploaded, reviewed
 * by the team, and approved by the client before any page content is generated. */
export const clientStageEnum = pgEnum("client_stage", [
  "intake",
  "mockup",
  "content",
  "review",
  "live",
]);

/** Vertical / site type. Maps to a vertical config + starter theme. */
export const siteTypeEnum = pgEnum("site_type", [
  "home_services",
  "dental_health",
  "legal",
  "other",
]);

/** Subscription tier (maintenance scope deferred — placeholder values). */
export const tierEnum = pgEnum("client_tier", ["tier_1", "tier_2", "tier_3"]);

/** Job lifecycle. gate_failed is distinct from failed; needs_review flags a job
 * that ran but produced unverified output a human must confirm (e.g. GBP/NAP
 * read with no available verification path). */
export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "gate_failed",
  "held",
  "needs_review",
]);

/** Generic checklist / change-ticket item status. */
export const itemStatusEnum = pgEnum("item_status", [
  "pending",
  "in_progress",
  "complete",
  "blocked",
  "skipped",
]);

/** content_pages lifecycle. */
export const contentStatusEnum = pgEnum("content_status", [
  "pending",
  "generating",
  "generated",
  "in_review",
  "approved",
  "rejected",
]);

/** Automated style gate result for a content page. */
export const gateStatusEnum = pgEnum("gate_status", [
  "pending",
  "passing",
  "failed",
]);

/** Deployment (push to live) status. */
export const deploymentStatusEnum = pgEnum("deployment_status", [
  "pending",
  "in_progress",
  "success",
  "failed",
  "rolled_back",
]);

/** Change ticket type. */
export const changeTicketTypeEnum = pgEnum("change_ticket_type", [
  "design",
  "content",
  "seo",
  "wireframe_over_limit",
  "bug",
  "other",
]);

/** Priority for change tickets. */
export const priorityEnum = pgEnum("priority", ["low", "normal", "high", "urgent"]);

/** Photo source tier (spec image hierarchy / L40-22). */
export const photoSourceEnum = pgEnum("photo_source", [
  "client",
  "gbp",
  "ai_generated",
  "licensed_stock",
]);

/** Brain Injection (Tier 3) response review status. */
export const brainInjectionStatusEnum = pgEnum("brain_injection_status", [
  "pending",
  "submitted",
  "reviewed",
]);

/** Worker heartbeat status. */
export const workerStatusEnum = pgEnum("worker_status", [
  "idle",
  "busy",
  "draining",
  "stopped",
]);

/** Command Center (review-queue) instruction lifecycle. A queued instruction is
 * executed by a human / Claude-Code operator with judgment, never auto-run. */
export const commandStatusEnum = pgEnum("command_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

/* ============================================================
 * team_members
 * ========================================================== */

export const teamMembers = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    role: teamRoleEnum("role").notNull(),
    email: text("email").notNull(),
    username: varchar("username", { length: 64 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    /** TOTP secret reference. In prod the secret lives in Supabase Vault;
     * this column stores the Vault key id, never the raw seed. */
    totpSecret: text("totp_secret"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    usernameIdx: uniqueIndex("team_members_username_idx").on(t.username),
    emailIdx: uniqueIndex("team_members_email_idx").on(t.email),
  })
);

/* ============================================================
 * clients
 * ========================================================== */

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    businessName: text("business_name").notNull(),
    siteUrl: text("site_url"),
    tier: tierEnum("tier"),
    siteType: siteTypeEnum("site_type").notNull().default("home_services"),
    assignedTo: integer("assigned_to").references(() => teamMembers.id),
    stage: clientStageEnum("stage").notNull().default("intake"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    doServerId: text("do_server_id"),
    stagingUrl: text("staging_url"),
    liveUrl: text("live_url"),
    /** Managed hosting: when true, intake runs via the wp_intake handler (SSH + WP-CLI
     * against the client's WordPress server) instead of a public-site scrape. */
    managedHosting: boolean("managed_hosting").notNull().default(false),
    serverHost: text("server_host"),
    serverUser: text("server_user"),
    serverPath: text("server_path"),
    /** Mockup stage: client sign-off gate. The "Start Content Build" action and
     * generate_page jobs are blocked until the uploaded mockup is approved. */
    mockupApproved: boolean("mockup_approved").notNull().default(false),
    /** Workspace key of the uploaded design mockup (HTML or image) under
     * workspace/<slug>/mockups/. Injected into generate_page as a layout reference. */
    mockupFilePath: text("mockup_file_path"),
    /** Free-form team notes: intake context, client requests, anything not in client-facts.md. */
    notes: text("notes"),
    /** Local 40 Phase 2/3 are rank-map gated. Verdict surfaced to the team. */
    rankMapVerdict: text("rank_map_verdict"),
    /** Highest Local 40 phase unlocked for this client. */
    phaseUnlocked: integer("phase_unlocked").notNull().default(1),
    // soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: integer("deleted_by").references(() => teamMembers.id),
  },
  (t) => ({
    slugIdx: uniqueIndex("clients_slug_idx").on(t.slug),
    stageIdx: index("clients_stage_idx").on(t.stage),
  })
);

/* ============================================================
 * jobs
 * ========================================================== */

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    /** Matches a worker handler / BullMQ queue name, e.g. "site_scrape". */
    taskType: varchar("task_type", { length: 64 }).notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    queuedBy: integer("queued_by").references(() => teamMembers.id),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Append-only execution log (newline-delimited). */
    log: text("log").notNull().default(""),
    /** Output file paths written to DO Spaces. */
    outputFiles: jsonb("output_files").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    retryCount: integer("retry_count").notNull().default(0),
    /** Age of the KB cache used for this job (minutes). */
    kbCacheAgeMinutes: integer("kb_cache_age_minutes"),
    /** True when the job ran on a stale (>0, <24h) KB cache. */
    kbCacheWarn: boolean("kb_cache_warn").notNull().default(false),
    /** Optional structured payload params (page type, keyword, city, etc.). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    errorMessage: text("error_message"),
  },
  (t) => ({
    clientIdx: index("jobs_client_idx").on(t.clientId),
    statusIdx: index("jobs_status_idx").on(t.status),
    typeIdx: index("jobs_type_idx").on(t.taskType),
  })
);

/* ============================================================
 * checklist_items
 * ========================================================== */

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    stage: clientStageEnum("stage").notNull(),
    itemName: text("item_name").notNull(),
    status: itemStatusEnum("status").notNull().default("pending"),
    assignedTo: integer("assigned_to").references(() => teamMembers.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    /** Maintenance scope deferred — null placeholder per spec. */
    tierRequired: tierEnum("tier_required"),
    sortOrder: integer("sort_order").notNull().default(0),
    // soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: integer("deleted_by").references(() => teamMembers.id),
  },
  (t) => ({
    clientStageIdx: index("checklist_client_stage_idx").on(t.clientId, t.stage),
  })
);

/* ============================================================
 * change_tickets
 * ========================================================== */

export const changeTickets = pgTable(
  "change_tickets",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    type: changeTicketTypeEnum("type").notNull(),
    description: text("description").notNull(),
    priority: priorityEnum("priority").notNull().default("normal"),
    status: itemStatusEnum("status").notNull().default("pending"),
    createdBy: integer("created_by").references(() => teamMembers.id),
    assignedTo: integer("assigned_to").references(() => teamMembers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Links a fix to the deployment that shipped it. */
    pushId: integer("push_id"),
    // soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: integer("deleted_by").references(() => teamMembers.id),
  },
  (t) => ({
    clientIdx: index("change_tickets_client_idx").on(t.clientId),
  })
);

/* ============================================================
 * deployments
 * ========================================================== */

export const deployments = pgTable(
  "deployments",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    pushedBy: integer("pushed_by").references(() => teamMembers.id),
    pushedAt: timestamp("pushed_at", { withTimezone: true }).notNull().defaultNow(),
    fileCount: integer("file_count").notNull().default(0),
    status: deploymentStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    /** Snapshot retained 30 days for rollback. */
    snapshotPath: text("snapshot_path"),
  },
  (t) => ({
    clientIdx: index("deployments_client_idx").on(t.clientId),
  })
);

/* ============================================================
 * photos
 * ========================================================== */

export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    filename: text("filename").notNull(),
    source: photoSourceEnum("source").notNull(),
    /** Zone the photo is suited to (hero, before_after, gallery, proof, etc.). */
    zoneType: text("zone_type"),
    pageAssigned: text("page_assigned"),
    altText: text("alt_text"),
    /** License id for licensed_stock images; null otherwise. */
    licenseId: text("license_id"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    optimized: boolean("optimized").notNull().default(false),
    /** Provider, prompt, model, seed for AI-generated images. */
    generationMetadata: jsonb("generation_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    // soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: integer("deleted_by").references(() => teamMembers.id),
  },
  (t) => ({
    clientIdx: index("photos_client_idx").on(t.clientId),
  })
);

/* ============================================================
 * wireframe_pages (schema only — Wireframe stage deferred to Phase 4)
 * ========================================================== */

export const wireframePages = pgTable(
  "wireframe_pages",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    pageType: text("page_type").notNull(),
    round: integer("round").notNull().default(1),
    maxRounds: integer("max_rounds").notNull().default(2),
    status: itemStatusEnum("status").notNull().default("pending"),
    filePath: text("file_path"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    clientNotes: text("client_notes"),
    reviewToken: text("review_token"),
    reviewTokenUsed: boolean("review_token_used").notNull().default(false),
    /** Hard-locked at DB level: true when round >= max_rounds. */
    roundLocked: boolean("round_locked").notNull().default(false),
    // soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: integer("deleted_by").references(() => teamMembers.id),
  },
  (t) => ({
    clientIdx: index("wireframe_pages_client_idx").on(t.clientId),
    reviewTokenIdx: uniqueIndex("wireframe_pages_review_token_idx").on(t.reviewToken),
  })
);

/* ============================================================
 * client_annotations (schema only — annotation tool deferred to Phase 4)
 * ========================================================== */

export const clientAnnotations = pgTable("client_annotations", {
  id: serial("id").primaryKey(),
  wireframePageId: integer("wireframe_page_id")
    .notNull()
    .references(() => wireframePages.id),
  elementSelector: text("element_selector"),
  color: varchar("color", { length: 16 }),
  noteText: text("note_text").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  submittedByToken: text("submitted_by_token"),
});

/* ============================================================
 * content_pages
 * ========================================================== */

export const contentPages = pgTable(
  "content_pages",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    pageType: text("page_type").notNull(),
    slug: text("slug").notNull(),
    title: text("title"),
    status: contentStatusEnum("status").notNull().default("pending"),
    wordCount: integer("word_count").notNull().default(0),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    approvedBy: integer("approved_by").references(() => teamMembers.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    schemaGenerated: boolean("schema_generated").notNull().default(false),
    verifyFlagsCount: integer("verify_flags_count").notNull().default(0),
    verifyFlagsResolved: integer("verify_flags_resolved").notNull().default(0),
    /** Rollback buffer for the previous generated content. */
    previousContentMd: text("previous_content_md"),
    previousStatus: contentStatusEnum("previous_status"),
    gateStatus: gateStatusEnum("gate_status").notNull().default("pending"),
    gateFailureReason: text("gate_failure_reason"),
    // soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: integer("deleted_by").references(() => teamMembers.id),
  },
  (t) => ({
    clientIdx: index("content_pages_client_idx").on(t.clientId),
    clientSlugIdx: uniqueIndex("content_pages_client_slug_idx").on(t.clientId, t.slug),
  })
);

/* ============================================================
 * lls_scorecards (schema only — no UI in MVP)
 * ========================================================== */

export const llsScorecards = pgTable("lls_scorecards", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  onSiteSeoScore: integer("on_site_seo_score"),
  gbpMatchScore: integer("gbp_match_score"),
  aiSearchReadyScore: integer("ai_search_ready_score"),
  onSiteSeoGrade: varchar("on_site_seo_grade", { length: 4 }),
  gbpMatchGrade: varchar("gbp_match_grade", { length: 4 }),
  aiSearchReadyGrade: varchar("ai_search_ready_grade", { length: 4 }),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }),
  gbpOauthConnected: boolean("gbp_oauth_connected").notNull().default(false),
});

/* ============================================================
 * worker_heartbeats + summary
 * ========================================================== */

export const workerHeartbeats = pgTable(
  "worker_heartbeats",
  {
    id: serial("id").primaryKey(),
    workerId: text("worker_id").notNull(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    jobsProcessed: integer("jobs_processed").notNull().default(0),
    currentJobId: integer("current_job_id").references(() => jobs.id),
    status: workerStatusEnum("status").notNull().default("idle"),
  },
  (t) => ({
    workerIdx: index("worker_heartbeats_worker_idx").on(t.workerId),
    lastSeenIdx: index("worker_heartbeats_last_seen_idx").on(t.lastSeen),
  })
);

/** Monthly aggregate written before heartbeat rows are pruned (spec Table 35). */
export const workerHeartbeatSummary = pgTable("worker_heartbeat_summary", {
  id: serial("id").primaryKey(),
  workerId: text("worker_id").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  totalJobsProcessed: integer("total_jobs_processed").notNull().default(0),
  uptimeMinutes: integer("uptime_minutes").notNull().default(0),
});

/* ============================================================
 * lls_brain_injection_responses (Tier 3)
 * ========================================================== */

export const llsBrainInjectionResponses = pgTable(
  "lls_brain_injection_responses",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    responseToken: text("response_token").notNull(),
    status: brainInjectionStatusEnum("status").notNull().default("pending"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    bestCustomerDescription: text("best_customer_description"),
    proudOf: text("proud_of"),
    bestCustomerStory: text("best_customer_story"),
    differentiator: text("differentiator"),
    wishCustomersKnew: text("wish_customers_knew"),
    additionalNotes: text("additional_notes"),
    reviewedBy: integer("reviewed_by").references(() => teamMembers.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: uniqueIndex("brain_injection_token_idx").on(t.responseToken),
    clientIdx: index("brain_injection_client_idx").on(t.clientId),
  })
);

/* ============================================================
 * lls_iris_memory (schema only — Brain Injection answers feed this at conf 1.0)
 * ========================================================== */

export const llsIrisMemory = pgTable(
  "lls_iris_memory",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    memoryKey: text("memory_key").notNull(),
    memoryValue: text("memory_value").notNull(),
    source: text("source").notNull().default("brain_injection"),
    confidence: integer("confidence").notNull().default(100), // stored as 0-100 (1.0 == 100)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientKeyIdx: index("iris_memory_client_key_idx").on(t.clientId, t.memoryKey),
  })
);

/* ============================================================
 * lls_audit_log
 * ========================================================== */

export const llsAuditLog = pgTable(
  "lls_audit_log",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => teamMembers.id),
    actorRole: teamRoleEnum("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    previousValue: jsonb("previous_value").$type<Record<string, unknown> | null>(),
    newValue: jsonb("new_value").$type<Record<string, unknown> | null>(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index("audit_log_actor_idx").on(t.actorId),
    entityIdx: index("audit_log_entity_idx").on(t.entityType, t.entityId),
    createdIdx: index("audit_log_created_idx").on(t.createdAt),
  })
);

/* ============================================================
 * lls_commands (Command Center review queue)
 * ========================================================== */

/** Free-form instructions queued from the browser for the server operator
 * (Claude Code) to run with judgment. There is no auto-executor: a human reads
 * the row, acts, and posts the result back. Deliberately NOT a remote shell. */
export const llsCommands = pgTable(
  "lls_commands",
  {
    id: serial("id").primaryKey(),
    instruction: text("instruction").notNull(),
    status: commandStatusEnum("status").notNull().default("pending"),
    output: text("output"),
    queuedBy: text("queued_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("lls_commands_status_idx").on(t.status),
    createdIdx: index("lls_commands_created_idx").on(t.createdAt),
  })
);

/* ============================================================
 * Relations
 * ========================================================== */

export const clientsRelations = relations(clients, ({ one, many }) => ({
  assignee: one(teamMembers, {
    fields: [clients.assignedTo],
    references: [teamMembers.id],
  }),
  jobs: many(jobs),
  checklistItems: many(checklistItems),
  changeTickets: many(changeTickets),
  deployments: many(deployments),
  photos: many(photos),
  wireframePages: many(wireframePages),
  contentPages: many(contentPages),
  brainInjection: many(llsBrainInjectionResponses),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  client: one(clients, { fields: [jobs.clientId], references: [clients.id] }),
  queuedByMember: one(teamMembers, {
    fields: [jobs.queuedBy],
    references: [teamMembers.id],
  }),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  client: one(clients, { fields: [checklistItems.clientId], references: [clients.id] }),
  assignee: one(teamMembers, {
    fields: [checklistItems.assignedTo],
    references: [teamMembers.id],
  }),
}));

export const contentPagesRelations = relations(contentPages, ({ one }) => ({
  client: one(clients, { fields: [contentPages.clientId], references: [clients.id] }),
  approver: one(teamMembers, {
    fields: [contentPages.approvedBy],
    references: [teamMembers.id],
  }),
}));

export const wireframePagesRelations = relations(wireframePages, ({ one, many }) => ({
  client: one(clients, { fields: [wireframePages.clientId], references: [clients.id] }),
  annotations: many(clientAnnotations),
}));

export const clientAnnotationsRelations = relations(clientAnnotations, ({ one }) => ({
  wireframePage: one(wireframePages, {
    fields: [clientAnnotations.wireframePageId],
    references: [wireframePages.id],
  }),
}));

export const brainInjectionRelations = relations(llsBrainInjectionResponses, ({ one }) => ({
  client: one(clients, {
    fields: [llsBrainInjectionResponses.clientId],
    references: [clients.id],
  }),
  reviewer: one(teamMembers, {
    fields: [llsBrainInjectionResponses.reviewedBy],
    references: [teamMembers.id],
  }),
}));

/* ============================================================
 * Inferred types
 * ========================================================== */

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type NewChecklistItem = typeof checklistItems.$inferInsert;
export type ChangeTicket = typeof changeTickets.$inferSelect;
export type Deployment = typeof deployments.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type WireframePage = typeof wireframePages.$inferSelect;
export type ContentPage = typeof contentPages.$inferSelect;
export type NewContentPage = typeof contentPages.$inferInsert;
export type Scorecard = typeof llsScorecards.$inferSelect;
export type WorkerHeartbeat = typeof workerHeartbeats.$inferSelect;
export type BrainInjectionResponse = typeof llsBrainInjectionResponses.$inferSelect;
export type AuditLogEntry = typeof llsAuditLog.$inferSelect;
export type NewAuditLogEntry = typeof llsAuditLog.$inferInsert;
export type LlsCommand = typeof llsCommands.$inferSelect;
export type NewLlsCommand = typeof llsCommands.$inferInsert;

export type TeamRole = (typeof teamRoleEnum.enumValues)[number];
export type ClientStage = (typeof clientStageEnum.enumValues)[number];
export type JobStatus = (typeof jobStatusEnum.enumValues)[number];
export type ContentStatus = (typeof contentStatusEnum.enumValues)[number];
