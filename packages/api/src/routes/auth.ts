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
import {
  issueSession,
  cookieOptions,
  COOKIE_NAME,
  issuePartialLoginToken,
  verifyPartialLoginToken,
  issuePendingEnrollToken,
  verifyPendingEnrollToken,
  PENDING_ENROLL_COOKIE,
} from "../auth/session.js";
import { verifyToken, generateSecret, otpauthUrl, enrollmentQrDataUrl } from "../auth/totp.js";
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

    // MFA.
    //  - MFA_REQUIRED on + enrolled: do NOT issue a session on password alone.
    //    Return a short-lived partial token; the client completes login via
    //    POST /api/auth/totp/login with the TOTP code.
    //  - MFA_REQUIRED off + enrolled: preserve existing behavior — a provisioned
    //    secret must be satisfied inline with a valid code on this same call.
    //  - MFA_REQUIRED on + not enrolled: refused (no session, must enroll first).
    let mfaSatisfied: boolean;
    if (member.totpSecret) {
      if (env.mfaRequired) {
        res.json({ mfa_required: true, partial_token: issuePartialLoginToken(member.id, member.username) });
        return;
      }
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

/* ============================================================
 * TOTP MFA — two-step login completion + enrollment
 * ========================================================== */

/**
 * POST /api/auth/totp/login — complete a two-step login. Exchanges the partial
 * token (issued by /login when MFA is required) plus a TOTP code for a full
 * session. Never reveals which factor failed.
 */
const totpLoginSchema = z.object({
  partial_token: z.string().min(1),
  token: z.string().min(1),
});

authRouter.post(
  "/totp/login",
  asyncHandler(async (req, res) => {
    const { partial_token, token } = totpLoginSchema.parse(req.body);
    const claims = verifyPartialLoginToken(partial_token);
    if (!claims) throw new HttpError(401, "Invalid or expired login session", "MFA_PARTIAL_EXPIRED");

    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, claims.sub), eq(teamMembers.active, true)))
      .limit(1);
    if (!member || !member.totpSecret || !verifyToken(token, member.totpSecret)) {
      throw new HttpError(401, "Invalid MFA code");
    }

    const session = issueSession({ sub: member.id, role: member.role, username: member.username, mfa: true });
    res.cookie(COOKIE_NAME, session, cookieOptions());

    await writeAudit({
      actorId: member.id,
      actorRole: member.role,
      action: "login_mfa",
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

/** GET /api/auth/totp — enrollment status for the current user. */
authRouter.get(
  "/totp",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [member] = await db
      .select({ totpSecret: teamMembers.totpSecret })
      .from(teamMembers)
      .where(eq(teamMembers.id, req.auth!.sub))
      .limit(1);
    if (!member) throw new HttpError(401, "Session user no longer exists");
    res.json({ enrolled: Boolean(member.totpSecret) });
  })
);

/**
 * GET /api/auth/totp/setup — generate a fresh TOTP secret and return it plus an
 * otpauth:// URI and a QR data URL. Does NOT persist the secret; it is held in a
 * short-lived httpOnly cookie until POST /totp/verify confirms a valid code.
 */
authRouter.get(
  "/totp/setup",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const secret = generateSecret();
    const uri = otpauthUrl(auth.username, secret);
    const qrDataUrl = await enrollmentQrDataUrl(auth.username, secret);

    res.cookie(PENDING_ENROLL_COOKIE, issuePendingEnrollToken(auth.sub, secret), {
      httpOnly: true,
      secure: env.isProd(),
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });

    res.json({ secret, otpauthUrl: uri, qrDataUrl });
  })
);

/**
 * POST /api/auth/totp/verify — verify the entered code against the pending
 * secret (from the enrollment cookie). On success, persist the secret to the
 * member and mark them enrolled.
 */
const totpVerifySchema = z.object({ token: z.string().min(1) });

authRouter.post(
  "/totp/verify",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const { token } = totpVerifySchema.parse(req.body);

    const pending = verifyPendingEnrollToken(req.cookies?.[PENDING_ENROLL_COOKIE] ?? "");
    if (!pending || pending.sub !== auth.sub) {
      throw new HttpError(400, "No active enrollment. Start setup again.", "TOTP_SETUP_EXPIRED");
    }
    if (!verifyToken(token, pending.secret)) {
      throw new HttpError(400, "Code did not match. Check your authenticator and try again.");
    }

    await db.update(teamMembers).set({ totpSecret: pending.secret }).where(eq(teamMembers.id, auth.sub));
    res.clearCookie(PENDING_ENROLL_COOKIE, { path: "/" });

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "totp_enroll",
      entityType: "team_member",
      entityId: auth.sub,
      ipAddress: req.ip ?? null,
    });

    res.json({ enrolled: true });
  })
);

/**
 * DELETE /api/auth/totp — unenroll MFA. A user may always remove their own; only
 * matt/tyler may remove another member's (to reset a lost authenticator).
 */
const totpDeleteSchema = z.object({ userId: z.number().int().optional() });

authRouter.delete(
  "/totp",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const body = totpDeleteSchema.parse(req.body ?? {});
    const targetId = body.userId ?? auth.sub;

    if (targetId !== auth.sub && auth.role !== "matt" && auth.role !== "tyler") {
      throw new HttpError(403, "Only matt or tyler may reset another member's MFA");
    }

    const [target] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.id, targetId))
      .limit(1);
    if (!target) throw new HttpError(404, "Team member not found");

    await db.update(teamMembers).set({ totpSecret: null }).where(eq(teamMembers.id, targetId));

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "totp_unenroll",
      entityType: "team_member",
      entityId: targetId,
      ipAddress: req.ip ?? null,
    });

    res.json({ enrolled: false });
  })
);
