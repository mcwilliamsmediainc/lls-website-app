/**
 * External status endpoint.
 *
 * GET /api/status — returns the last 10 finished (completed or failed) commands
 * as plain text for
 * external monitoring services. This is NOT the session-authenticated surface:
 * it is gated by a dedicated STATUS_API_TOKEN bearer token (separate from the
 * worker token and from user sessions) so a monitoring service can read it
 * without a full login.
 *
 * Because the lls_commands.output column holds RAW operator output that can
 * contain secrets, everything served here is redacted with the same rules as
 * /root/publish-status.sh before it leaves the process. Full, unredacted detail
 * stays behind the authenticated /api/commands surface and the Command Center UI.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { desc, inArray } from "drizzle-orm";
import { db, llsCommands } from "../lib/db.js";
import { env } from "../lib/env.js";
import { asyncHandler } from "../middleware/error.js";

export const statusRouter = Router();

/** Concrete secret values to scrub from any output before it leaves the box. */
const SECRET_VALUES = [
  env.workerToken,
  env.authSecret,
  env.databaseUrl,
  env.redisUrl,
  env.spaces.secret,
  env.spaces.key,
].filter((s): s is string => Boolean(s) && s.length >= 6);

/** Mirror of the redaction in publish-status.sh: known secrets + secret-shaped patterns. */
function redact(text: string | null | undefined): string {
  if (!text) return "";
  let t = text;
  for (const s of SECRET_VALUES) t = t.split(s).join("[REDACTED]");
  t = t.replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, "[REDACTED_TOKEN]");
  t = t.replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_KEY]");
  t = t.replace(
    /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
    "[REDACTED_PRIVATE_KEY]"
  );
  t = t.replace(
    /^(\s*[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|APIKEY|API_KEY|KEY|PASS)[A-Z0-9_]*\s*[=:]\s*)\S+/gim,
    "$1[REDACTED]"
  );
  t = t.replace(/\b[0-9a-f]{32,}\b/g, "[REDACTED_HEX]");
  return t;
}

/** Constant-time bearer-token check against STATUS_API_TOKEN. */
function requireStatusToken(req: Request, res: Response, next: NextFunction): void {
  if (!env.statusToken) {
    res.status(503).type("text/plain").send("STATUS_API_TOKEN not configured on the server\n");
    return;
  }
  const header = req.header("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(presented);
  const b = Buffer.from(env.statusToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).type("text/plain").send("Unauthorized\n");
    return;
  }
  next();
}

statusRouter.get(
  "/",
  requireStatusToken,
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(llsCommands)
      .where(inArray(llsCommands.status, ["completed", "failed"]))
      .orderBy(desc(llsCommands.completedAt))
      .limit(10);

    const lines = rows.map((c) => {
      const ts = c.completedAt ? new Date(c.completedAt).toISOString() : "";
      const instr = redact(c.instruction).replace(/\s+/g, " ").slice(0, 300);
      let out = redact(c.output).trim();
      if (out.length > 2000) out = out.slice(0, 2000) + " …(truncated)";
      out = out.replace(/\n/g, " ");
      return `[${ts}] ${c.status.toUpperCase()} ${instr} :: ${out}`;
    });

    res
      .status(200)
      .type("text/plain")
      .send((lines.length ? lines.join("\n") : "(no completed or failed commands yet)") + "\n");
  })
);
