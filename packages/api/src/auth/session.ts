/**
 * Session tokens. Issues short-lived JWTs carried in an httpOnly cookie.
 *
 * Spec session policy (Table 30): 8h activity expiry, 24h absolute max, MFA
 * required. Full server-side Redis session store + concurrent-session limits are
 * Phase 3; this build issues a signed JWT with the documented expiries and a
 * `mfa` claim so routes can require a fully authenticated (MFA-passed) session.
 */

import jwt from "jsonwebtoken";
import { env } from "../lib/env.js";
import type { TeamRole } from "../lib/db.js";

export interface SessionClaims {
  sub: number; // team member id
  role: TeamRole;
  username: string;
  /** true once the TOTP step has been completed for this session */
  mfa: boolean;
}

const ACTIVITY_EXPIRY = "8h";
export const COOKIE_NAME = "lls_session";

export function issueSession(claims: SessionClaims): string {
  return jwt.sign(claims, env.authSecret, { expiresIn: ACTIVITY_EXPIRY });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    return jwt.verify(token, env.authSecret) as unknown as SessionClaims;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ MFA flow --
 * Short-lived, single-purpose tokens used by the two-step login and enrollment
 * flows. They are signed with the same secret but carry a `purpose` claim so a
 * partial-login token can never be replayed as a full session or vice versa.
 */

export interface PartialLoginClaims {
  sub: number;
  username: string;
  purpose: "mfa_partial";
}

/** Issued after a correct password when MFA is required; exchanged for a full
 * session by POST /api/auth/totp/login once the TOTP code is verified. */
export function issuePartialLoginToken(sub: number, username: string): string {
  return jwt.sign({ sub, username, purpose: "mfa_partial" } satisfies PartialLoginClaims, env.authSecret, {
    expiresIn: "5m",
  });
}

export function verifyPartialLoginToken(token: string): PartialLoginClaims | null {
  try {
    const claims = jwt.verify(token, env.authSecret) as unknown as PartialLoginClaims;
    return claims.purpose === "mfa_partial" ? claims : null;
  } catch {
    return null;
  }
}

export interface PendingEnrollClaims {
  sub: number;
  secret: string;
  purpose: "totp_enroll";
}

/** Holds the not-yet-saved TOTP secret between GET /totp/setup and POST
 * /totp/verify. Carried in an httpOnly cookie so the secret never round-trips
 * through the client on the verify call (which only sends the code). */
export function issuePendingEnrollToken(sub: number, secret: string): string {
  return jwt.sign({ sub, secret, purpose: "totp_enroll" } satisfies PendingEnrollClaims, env.authSecret, {
    expiresIn: "10m",
  });
}

export function verifyPendingEnrollToken(token: string): PendingEnrollClaims | null {
  try {
    const claims = jwt.verify(token, env.authSecret) as unknown as PendingEnrollClaims;
    return claims.purpose === "totp_enroll" ? claims : null;
  } catch {
    return null;
  }
}

export const PENDING_ENROLL_COOKIE = "lls_totp_pending";

export function cookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    secure: env.isProd(),
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  };
}
