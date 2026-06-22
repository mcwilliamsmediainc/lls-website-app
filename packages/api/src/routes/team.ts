/**
 * Team administration (Settings > Team). Gated to edit_team_members (matt, tyler).
 *
 * View existing seeded users, change their role, and reset their password. There
 * is no invite/create flow in this build — the roster is seeded.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
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
  hasTotp: sql<boolean>`${teamMembers.totpSecret} is not null`,
};

/** List all team members. */
teamRouter.get(
  "/",
  requireAuth,
  requirePermission("edit_team_members"),
  asyncHandler(async (_req, res) => {
    const rows = await db.select(memberColumns).from(teamMembers).orderBy(asc(teamMembers.id));
    res.json(rows);
  })
);

/** Change a member's role. */
teamRouter.patch(
  "/:id/role",
  requireAuth,
  requirePermission("edit_team_members"),
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { role } = z.object({ role: z.enum(ROLE_VALUES) }).parse(req.body);
    const auth = req.auth!;

    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
    if (!member) throw new HttpError(404, "Team member not found");

    const [updated] = await db
      .update(teamMembers)
      .set({ role: role as TeamRole })
      .where(eq(teamMembers.id, id))
      .returning(memberColumns);

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "update_team_member_role",
      entityType: "team_member",
      entityId: id,
      previousValue: { role: member.role },
      newValue: { role },
      ipAddress: req.ip ?? null,
    });
    res.json(updated);
  })
);

/** Reset a member's password (admin action — no email round-trip in this build). */
teamRouter.post(
  "/:id/reset-password",
  requireAuth,
  requirePermission("edit_team_members"),
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { password } = z
      .object({ password: z.string().min(8, "Password must be at least 8 characters") })
      .parse(req.body);
    const auth = req.auth!;

    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
    if (!member) throw new HttpError(404, "Team member not found");

    const passwordHash = await bcrypt.hash(password, 12);
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
    res.json({ ok: true, username: member.username });
  })
);
