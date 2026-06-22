/**
 * Worker authentication. The BullMQ worker calls back into the API
 * (job updates, file writes, checklist completion). It presents a shared secret
 * via the x-worker-token header instead of a user session.
 */

import type { Request, Response, NextFunction } from "express";
import { env } from "../lib/env.js";

export function requireWorker(req: Request, res: Response, next: NextFunction): void {
  const token = req.header("x-worker-token");
  if (!env.workerToken) {
    res.status(503).json({ error: "WORKER_API_TOKEN not configured on the server" });
    return;
  }
  if (token !== env.workerToken) {
    res.status(401).json({ error: "Invalid worker token" });
    return;
  }
  next();
}
