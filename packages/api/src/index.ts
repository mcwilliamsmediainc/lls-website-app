/**
 * LLS Build Workspace — Express API entry point.
 */

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./lib/env.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFound } from "./middleware/error.js";

import { authRouter } from "./routes/auth.js";
import { clientsRouter } from "./routes/clients.js";
import { jobsRouter } from "./routes/jobs.js";
import { checklistRouter } from "./routes/checklist.js";
import { contentRouter } from "./routes/content.js";
import { deploymentsRouter } from "./routes/deployments.js";
import { systemRouter } from "./routes/system.js";
import { teamRouter } from "./routes/team.js";
import { commandsRouter } from "./routes/commands.js";
import { statusRouter } from "./routes/status.js";
import { photosRouter } from "./routes/photos.js";
import { onboardingPublicRouter, onboardingWorkspaceRouter } from "./routes/onboarding.js";

const app = express();
app.set("trust proxy", 1); // behind Cloudflare / DO load balancer

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Health check (unauthenticated)
app.get("/health", (_req, res) => res.json({ ok: true, service: "lls-api", env: env.nodeEnv }));

// Public Brain Injection onboarding form
app.use("/onboarding", onboardingPublicRouter);

// Authenticated API surface
app.use("/api/auth", authRouter);
app.use("/api", apiLimiter); // applies to everything mounted after this line
app.use("/api/clients", clientsRouter);
app.use("/api/clients", checklistRouter); // /:slug/checklist
app.use("/api/clients", onboardingWorkspaceRouter); // /:slug/brain-injection
app.use("/api/clients", deploymentsRouter); // /:slug/push-to-live, /:slug/deployments, /:slug/rollback
app.use("/api/clients", photosRouter); // /:slug/photos
app.use("/api/jobs", jobsRouter);
app.use("/api", contentRouter); // /content/* and /clients/:slug/content
app.use("/api", deploymentsRouter); // /deployments/:id/result
app.use("/api/system", systemRouter);
app.use("/api/team", teamRouter);
app.use("/api/commands", commandsRouter);
app.use("/api/status", statusRouter); // token-gated, redacted external monitoring read

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, () => {
  console.log(`[api] listening on :${env.port} (${env.nodeEnv})`);
  if (!env.workerToken) {
    console.warn("[api] WORKER_API_TOKEN is NOT set — all worker callbacks will 503 until it is configured");
  } else {
    console.log(`[api] WORKER_API_TOKEN fingerprint: ${env.workerToken.slice(0, 8)}… (len ${env.workerToken.length})`);
  }
});

function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app };
