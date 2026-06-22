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
