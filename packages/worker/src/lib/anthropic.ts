/**
 * Anthropic Claude client with the spec's retry + model-fallback behavior.
 *
 * - On 429: exponential backoff starting at 60s, doubling, max 5 retries, then throw.
 * - On a model-unavailable error: fall back to the next Sonnet model. Never block a
 *   build on a model preference.
 * - On other errors: throw immediately (caller marks the job failed, no auto-retry).
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env.js";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

const BASE_BACKOFF_MS = 60_000;
const MAX_RETRIES = 5;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimit(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { status?: number }).status === 429;
}

function isModelUnavailable(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { status?: number; error?: { error?: { message?: string } }; message?: string };
  const msg = (e.error?.error?.message ?? e.message ?? "").toLowerCase();
  return (e.status === 404 || e.status === 400) && msg.includes("model");
}

export interface ClaudeCallOptions {
  system?: string;
  maxTokens?: number;
  /** "page" uses the larger token budget for full-page generation. */
  budget?: "standard" | "page";
}

/** Calls Claude with one user message, returning the concatenated text output. */
export async function callClaude(prompt: string, opts: ClaudeCallOptions = {}): Promise<string> {
  const maxTokens =
    opts.maxTokens ?? (opts.budget === "page" ? env.anthropicMaxTokensPage : env.anthropicMaxTokens);
  const models = [env.anthropicModel, ...env.anthropicFallbackModels];

  let lastErr: unknown;
  for (const model of models) {
    let attempt = 0;
    // Retry loop for rate limits on this model.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const res = await client.messages.create({
          model,
          max_tokens: maxTokens,
          system: opts.system,
          messages: [{ role: "user", content: prompt }],
        });
        return res.content
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("")
          .trim();
      } catch (err) {
        lastErr = err;
        if (isRateLimit(err)) {
          if (attempt >= MAX_RETRIES) throw new Error(`Claude rate limited after ${MAX_RETRIES} retries`);
          const wait = BASE_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(`[claude] 429 on ${model}, backoff ${wait / 1000}s (attempt ${attempt + 1})`);
          await sleep(wait);
          attempt++;
          continue;
        }
        if (isModelUnavailable(err)) {
          console.warn(`[claude] model ${model} unavailable, trying next fallback`);
          break; // move to next model
        }
        throw err; // other errors: do not retry
      }
    }
  }
  throw new Error(`Claude call failed across all models: ${String(lastErr)}`);
}

/** Parse a JSON object from a Claude response, tolerating accidental code fences. */
export function parseJsonOutput<T = unknown>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as T;
}
