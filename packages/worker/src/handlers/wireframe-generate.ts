/**
 * wireframe-generate — DEFERRED to Phase 4.
 *
 * The Wireframe stage, annotation tool, and client review link are explicitly out
 * of scope for this build (kickoff prompt "WHAT NOT TO BUILD"). The queue and
 * handler slot exist so the architecture is ready, but the handler intentionally
 * refuses the job with a clear message rather than producing placeholder output.
 * Enable by implementing wireframe HTML generation in Phase 4.
 */

import { type JobHandler, type HandlerResult } from "../lib/types.js";

export const wireframeGenerate: JobHandler = async (): Promise<HandlerResult> => {
  return {
    outputFiles: [],
    log: ["wireframe_generate is deferred to Phase 4 and is not enabled in this build"],
    status: "failed",
    errorMessage: "wireframe_generate is a Phase 4 feature and is not enabled in this build",
  };
};
