/**
 * Command Center — review queue.
 *
 * matt/tyler queue free-form instructions from the browser; a human / Claude-Code
 * operator on the server reads them and runs them WITH JUDGMENT, then posts the
 * result back. There is intentionally NO executor here: no child_process, no
 * shell, nothing auto-runs. This is a review queue, not a remote shell. The
 * operator side lives in /root/review-commands.sh.
 */

import { Router } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, llsCommands } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { requireWorker } from "../middleware/worker.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { writeAudit } from "../lib/audit.js";

export const commandsRouter = Router();

const COMMAND_STATUSES = ["pending", "running", "completed", "failed"] as const;
type CommandStatus = (typeof COMMAND_STATUSES)[number];

const createSchema = z.object({
  instruction: z.string().min(1).max(4000),
  queued_by: z.string().min(1).max(64),
});

/** Queue an instruction for operator review. matt/tyler only (spec). */
commandsRouter.post(
  "/",
  requireAuth,
  requirePermission("queue_command"),
  asyncHandler(async (req, res) => {
    const { instruction, queued_by } = createSchema.parse(req.body);
    const auth = req.auth!;
    const [cmd] = await db
      .insert(llsCommands)
      .values({ instruction, queuedBy: queued_by, status: "pending" })
      .returning();
    if (!cmd) throw new HttpError(500, "Failed to create command");

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "queue_command",
      entityType: "lls_command",
      entityId: cmd.id,
      newValue: { instruction },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json(cmd);
  })
);

/** Last 50 commands, newest first. Optional ?status= filter. Any authed user. */
commandsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.status === "string" ? req.query.status : undefined;
    const status =
      raw && (COMMAND_STATUSES as readonly string[]).includes(raw)
        ? (raw as CommandStatus)
        : undefined;
    const rows = await db
      .select()
      .from(llsCommands)
      .where(status ? eq(llsCommands.status, status) : undefined)
      .orderBy(desc(llsCommands.createdAt))
      .limit(50);
    res.json(rows);
  })
);

/** Operator callback: post the execution result. Worker-token authenticated. */
const resultSchema = z.object({
  output: z.string(),
  status: z.enum(["running", "completed", "failed"]),
});

commandsRouter.post(
  "/:id/result",
  requireWorker,
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { output, status } = resultSchema.parse(req.body);

    const [existing] = await db.select().from(llsCommands).where(eq(llsCommands.id, id)).limit(1);
    if (!existing) throw new HttpError(404, "Command not found");

    const set: Record<string, unknown> = { status, output };
    if (status === "running" && !existing.startedAt) set.startedAt = new Date();
    if (status === "completed" || status === "failed") set.completedAt = new Date();

    const [updated] = await db.update(llsCommands).set(set).where(eq(llsCommands.id, id)).returning();
    res.json(updated);
  })
);
