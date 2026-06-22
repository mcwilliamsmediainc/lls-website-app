/**
 * Authentication middleware. Reads the session cookie, verifies the JWT, and
 * attaches the authenticated member to req.auth. Requires MFA to have passed.
 */

import type { Request, Response, NextFunction } from "express";
import { COOKIE_NAME, verifySession, type SessionClaims } from "../auth/session.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: SessionClaims;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const claims = verifySession(token);
  if (!claims) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  if (!claims.mfa) {
    res.status(403).json({ error: "MFA required", code: "MFA_REQUIRED" });
    return;
  }
  req.auth = claims;
  next();
}
