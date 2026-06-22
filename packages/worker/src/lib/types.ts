/** Shared worker types. */

export interface JobPayload {
  jobId: number;
  clientId: number;
  clientSlug: string;
  taskType: string;
  params: Record<string, unknown>;
}

export interface HandlerResult {
  /** Workspace-relative file paths written during the job. */
  outputFiles: string[];
  /** Lines appended to the job log. */
  log: string[];
  /** Final status override; defaults to "completed". */
  status?: "completed" | "failed" | "gate_failed" | "held" | "needs_review";
  errorMessage?: string;
}

export type JobHandler = (payload: JobPayload) => Promise<HandlerResult>;

export function paramString(params: Record<string, unknown>, key: string, fallback = ""): string {
  const v = params[key];
  return typeof v === "string" ? v : fallback;
}

export function paramArray(params: Record<string, unknown>, key: string): string[] {
  const v = params[key];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}
