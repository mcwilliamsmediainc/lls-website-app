/**
 * Rate limiters (spec Table 31). Cloudflare is the first line of defense in front
 * of public routes; these are app-level backstops.
 */

import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { env } from "../lib/env.js";

/**
 * Worker callbacks (job updates, photo registration, checklist completion) authenticate
 * with the shared x-worker-token secret and must never be rate limited: a large job can
 * fire hundreds of rapid callbacks, and a 429 on the final one is treated as a job failure
 * (leaving the jobs row stuck/partial). Only requests presenting the *valid* token are
 * exempted, so a bogus header cannot be used to bypass the limiter.
 */
export function isWorkerRequest(req: Request): boolean {
  return Boolean(env.workerToken) && req.header("x-worker-token") === env.workerToken;
}

/** Authenticated API: 100 req/min per user (falls back to IP if unauthenticated). */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.auth?.sub ? `u:${req.auth.sub}` : req.ip ?? "anon"),
  skip: isWorkerRequest,
  message: { error: "Too many requests" },
});

/** Job dispatch: 20 queues/min per user. */
export const jobDispatchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.auth?.sub ? `u:${req.auth.sub}` : req.ip ?? "anon"),
  skip: isWorkerRequest,
  message: { error: "Job dispatch rate limit exceeded" },
});

/** Push to Live: 1 push per client per 5 minutes. */
export const pushToLiveLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `push:${req.params.slug ?? req.ip}`,
  message: { error: "A push for this client was made in the last 5 minutes" },
});

/** Public onboarding form: protect against abuse of unauthenticated routes. */
export const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions, try again later" },
});
