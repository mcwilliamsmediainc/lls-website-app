/**
 * Team administration (Settings > Team).
 *
 * - GET is open to any authenticated role (read-only roster view).
 * - Create / update / reset-password are gated to edit_team_members (matt, tyler)
 *   via the same permission-matrix middleware as other admin-only routes.
 *
 * Temporary passwords are generated server-side, hashed with bcrypt before
 * storage, and returned to the caller exactly once. The plaintext is never
 * logged, persisted, or written to the audit trail.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db, teamMembers, teamRoleEnum, type TeamRole } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { writeAudit } from "../lib/audit.js";

export const teamRouter = Router();

const ROLE_VALUES = teamRoleEnum.enumValues as [string, ...string[]];

/** Public-safe team member projection (never returns passwordHash / totpSecret). */
const memberColumns = {
  id: teamMembers.id,
  name: teamMembers.name,
  role: teamMembers.role,
  username: teamMembers.username,
  email: teamMembers.email,
  active: teamMembers.active,
  createdAt: teamMembers.createdAt,
};

const BCRYPT_ROUNDS = 12;

/**
 * Generate a one-time temporary password. URL-safe, ~16 chars (always >= 8).
 * Returned to the admin once; only its bcrypt hash is ever stored.
 */
function generateTempPassword(): string {
  return randomBytes(12).toString("base64url");
}

/** List all team members. Any authenticated role may view (read-only). */
teamRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await db.select(memberColumns).from(teamMembers).orderBy(asc(teamMembers.id));
    res.json(rows);
  })
);

/** Create a team member. Returns the generated temp password once. */
const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(64, "Username must be 64 characters or fewer")
    .regex(/^[a-z0-9_.-]+$/i, "Username may contain only letters, numbers, dot, dash, underscore"),
  email: z.string().trim().email("A valid email is required"),
  role: z.enum(ROLE_VALUES),
});

teamRouter.post(
  "/",
  requireAuth,
  requirePermission("edit_team_members"),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const auth = req.auth!;

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    let created;
    try {
      [created] = await db
        .insert(teamMembers)
        .values({
          name: body.name,
          username: body.username,
          email: body.email,
          role: body.role as TeamRole,
          passwordHash,
        })
        .returning(memberColumns);
    } catch (err) {
      // Unique violation on username / email.
      if ((err as { code?: string }).code === "23505") {
        throw new HttpError(409, "A team member with that username or email already exists");
      }
      throw err;
    }
    if (!created) throw new HttpError(500, "Failed to create team member");

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "create_team_member",
      entityType: "team_member",
      entityId: created.id,
      newValue: { name: created.name, username: created.username, email: created.email, role: created.role },
      ipAddress: req.ip ?? null,
    });

    // tempPassword is returned exactly once and never logged.
    res.status(201).json({ ...created, tempPassword });
  })
);

/** Update name / email / role / active status. */
const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    role: z.enum(ROLE_VALUES).optional(),
    active: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "No fields to update" });

teamRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("edit_team_members"),
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = updateSchema.parse(req.body);
    const auth = req.auth!;

    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
    if (!member) throw new HttpError(404, "Team member not found");

    const set: Partial<typeof teamMembers.$inferInsert> = {};
    if (body.name !== undefined) set.name = body.name;
    if (body.email !== undefined) set.email = body.email;
    if (body.role !== undefined) set.role = body.role as TeamRole;
    if (body.active !== undefined) set.active = body.active;

    let updated;
    try {
      [updated] = await db.update(teamMembers).set(set).where(eq(teamMembers.id, id)).returning(memberColumns);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new HttpError(409, "Another team member already uses that email");
      }
      throw err;
    }

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "update_team_member",
      entityType: "team_member",
      entityId: id,
      previousValue: { name: member.name, email: member.email, role: member.role, active: member.active },
      newValue: body,
      ipAddress: req.ip ?? null,
    });
    res.json(updated);
  })
);

/** Reset a member's password. Server generates the temp password and returns it once. */
teamRouter.post(
  "/:id/reset-password",
  requireAuth,
  requirePermission("edit_team_members"),
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const auth = req.auth!;

    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
    if (!member) throw new HttpError(404, "Team member not found");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
    await db.update(teamMembers).set({ passwordHash }).where(eq(teamMembers.id, id));

    // Never log the password itself.
    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "reset_team_member_password",
      entityType: "team_member",
      entityId: id,
      ipAddress: req.ip ?? null,
    });
    res.json({ username: member.username, tempPassword });
  })
);
