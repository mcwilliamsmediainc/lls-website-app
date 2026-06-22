/**
 * Heartbeat emitter (spec + kickoff Section 9).
 * Posts the worker's status to the API every 60s. Tracks jobs processed and the
 * current job id so the Task Queue can show worker health and the dead-man switch
 * (last heartbeat > 5 min) can fire.
 */

import { env } from "./lib/env.js";
import { api } from "./lib/apiClient.js";

class Heartbeat {
  private jobsProcessed = 0;
  private currentJobId: number | null = null;
  private status: "idle" | "busy" | "draining" | "stopped" = "idle";
  private timer: NodeJS.Timeout | null = null;

  start(): void {
    void this.emit();
    this.timer = setInterval(() => void this.emit(), env.heartbeatIntervalMs);
    this.timer.unref?.();
  }

  setBusy(jobId: number): void {
    this.currentJobId = jobId;
    this.status = "busy";
    void this.emit();
  }

  setIdle(): void {
    this.currentJobId = null;
    this.status = "idle";
  }

  incrementProcessed(): void {
    this.jobsProcessed++;
  }

  async stop(): Promise<void> {
    this.status = "stopped";
    if (this.timer) clearInterval(this.timer);
    await this.emit().catch(() => undefined);
  }

  private async emit(): Promise<void> {
    try {
      await api.heartbeat({
        workerId: env.workerId,
        jobsProcessed: this.jobsProcessed,
        currentJobId: this.currentJobId,
        status: this.status,
      });
    } catch (err) {
      console.warn("[heartbeat] emit failed:", err);
    }
  }
}

export const heartbeat = new Heartbeat();
