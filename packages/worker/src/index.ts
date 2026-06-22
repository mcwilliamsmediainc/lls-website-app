/**
 * LLS worker entry. Boots the KB cache, starts the heartbeat, and registers one
 * BullMQ Worker per job-type queue. Each job is dispatched to its handler; results
 * are reported back to the API. KbStaleError holds the job; other errors fail it
 * (no auto-retry — Claude 429 backoff is handled inside the Anthropic client).
 */

import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./lib/env.js";
import { api } from "./lib/apiClient.js";
import { heartbeat } from "./heartbeat.js";
import { refreshKbCache, startKbRefreshLoop, KbStaleError } from "./kb-cache.js";
import { type JobHandler, type JobPayload } from "./lib/types.js";

import { siteScrape } from "./handlers/site-scrape.js";
import { urlInventory } from "./handlers/url-inventory.js";
import { gbpVerify } from "./handlers/gbp-verify.js";
import { geoResearch } from "./handlers/geo-research.js";
import { gapReport } from "./handlers/gap-report.js";
import { generatePage } from "./handlers/generate-page.js";
import { generateSchema } from "./handlers/generate-schema.js";
import { internalLinking } from "./handlers/internal-linking.js";
import { redirectMap } from "./handlers/redirect-map.js";
import { wireframeGenerate } from "./handlers/wireframe-generate.js";

const HANDLERS: Record<string, JobHandler> = {
  site_scrape: siteScrape,
  url_inventory: urlInventory,
  gbp_verify: gbpVerify,
  geo_research: geoResearch,
  gap_report: gapReport,
  generate_page: generatePage,
  generate_schema: generateSchema,
  internal_linking: internalLinking,
  redirect_map: redirectMap,
  wireframe_generate: wireframeGenerate,
};

const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });

async function processJob(job: Job<JobPayload>): Promise<void> {
  const payload = job.data;
  const handler = HANDLERS[payload.taskType];
  heartbeat.setBusy(payload.jobId);

  await api.updateJob({ jobId: payload.jobId, status: "running", log: `Worker ${env.workerId} picked up ${payload.taskType}` });

  if (!handler) {
    await api.updateJob({ jobId: payload.jobId, status: "failed", errorMessage: `No handler for ${payload.taskType}` });
    return;
  }

  try {
    const result = await handler(payload);
    await api.updateJob({
      jobId: payload.jobId,
      status: result.status ?? "completed",
      log: result.log.join("\n"),
      outputFiles: result.outputFiles,
      errorMessage: result.errorMessage,
    });
  } catch (err) {
    if (err instanceof KbStaleError) {
      await api.updateJob({
        jobId: payload.jobId,
        status: "held",
        log: `Held: ${err.message}`,
        errorMessage: err.message,
        kbCacheWarn: true,
      });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] job ${payload.jobId} (${payload.taskType}) failed:`, err);
    await api.updateJob({ jobId: payload.jobId, status: "failed", log: `Error: ${message}`, errorMessage: message });
  } finally {
    heartbeat.incrementProcessed();
    heartbeat.setIdle();
  }
}

async function main() {
  console.log(`[worker] ${env.workerId} starting (concurrency ${env.concurrentBuilds})`);
  console.log(
    `[worker] WORKER_API_TOKEN fingerprint: ${env.workerToken.slice(0, 8)}… (len ${env.workerToken.length}) -> ${env.apiBaseUrl}`
  );
  await refreshKbCache();
  const stopKb = startKbRefreshLoop();
  heartbeat.start();

  const workers = Object.keys(HANDLERS).map(
    (queueName) =>
      new Worker<JobPayload>(queueName, processJob, {
        connection,
        concurrency: env.concurrentBuilds,
      })
  );

  for (const w of workers) {
    w.on("failed", (job, err) => console.error(`[worker] ${w.name} job ${job?.id} failed:`, err.message));
  }

  async function shutdown(signal: string) {
    console.log(`[worker] ${signal} received, draining`);
    stopKb();
    await Promise.all(workers.map((w) => w.close()));
    await heartbeat.stop();
    await connection.quit();
    process.exit(0);
  }
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
