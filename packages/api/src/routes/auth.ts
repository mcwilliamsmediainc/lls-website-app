/**
 * Auth routes. Username + password login with optional TOTP verification.
 *
 * Per the kickoff prompt, the MFA *enrollment UI* is deferred to Phase 3 (the
 * totp_secret column exists but no enrollment flow is built here). TOTP
 * verification is wired in so that once a member has a secret provisioned, login
 * requires a valid code — no app changes needed when MFA is switched on.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, teamMembers } from "../lib/db.js";
import { issueSession, cookieOptions, COOKIE_NAME } from "../auth/session.js";
import { verifyToken } from "../auth/totp.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { permissionsFor } from "../lib/permissions.js";
import { writeAudit } from "../lib/audit.js";
import { env } from "../lib/env.js";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  token: z.string().optional(),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password, token } = loginSchema.parse(req.body);

    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.username, username), eq(teamMembers.active, true)))
      .limit(1);

    const ok = member ? await bcrypt.compare(password, member.passwordHash) : false;
    if (!member || !ok) {
      // Constant-ish failure response; do not reveal which factor failed.
      throw new HttpError(401, "Invalid credentials");
    }

    // MFA. A member with a provisioned TOTP secret must always present a valid
    // code. A member without one can only get a fully authed session when MFA
    // enforcement is off (internal testing); when MFA_REQUIRED is on there is no
    // enrollment flow in this build, so login is refused rather than silently
    // bypassing MFA (the previous bug).
    let mfaSatisfied: boolean;
    if (member.totpSecret) {
      if (!token || !verifyToken(token, member.totpSecret)) {
        throw new HttpError(401, "Invalid or missing MFA code", "MFA_REQUIRED");
      }
      mfaSatisfied = true;
    } else if (env.mfaRequired) {
      throw new HttpError(
        403,
        "MFA is required but not enrolled for this account. An administrator must provision a TOTP secret before you can sign in.",
        "MFA_ENROLLMENT_REQUIRED"
      );
    } else {
      mfaSatisfied = true;
    }

    const session = issueSession({
      sub: member.id,
      role: member.role,
      username: member.username,
      mfa: mfaSatisfied,
    });
    res.cookie(COOKIE_NAME, session, cookieOptions());

    await writeAudit({
      actorId: member.id,
      actorRole: member.role,
      action: "login",
      entityType: "team_member",
      entityId: member.id,
      ipAddress: req.ip ?? null,
      userAgent: req.header("user-agent") ?? null,
    });

    res.json({
      user: { id: member.id, name: member.name, role: member.role, username: member.username },
      permissions: permissionsFor(member.role),
    });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const [member] = await db
      .select({ id: teamMembers.id, name: teamMembers.name, role: teamMembers.role, username: teamMembers.username })
      .from(teamMembers)
      .where(eq(teamMembers.id, auth.sub))
      .limit(1);
    if (!member) throw new HttpError(401, "Session user no longer exists");
    res.json({ user: member, permissions: permissionsFor(member.role) });
  })
);
