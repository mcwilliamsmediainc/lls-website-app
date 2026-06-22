/**
 * Gemini grounding for public GBP / web reads — the preferred least-friction GBP
 * read path (no credentials beyond GEMINI_API_KEY). Falls back gracefully: callers
 * should be prepared for an empty result when GEMINI_API_KEY is not set.
 */

import { env } from "./env.js";

const MODEL = "gemini-1.5-pro";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export function geminiAvailable(): boolean {
  return Boolean(env.geminiApiKey);
}

/**
 * Runs a grounded Gemini query (Google Search retrieval enabled) and returns the
 * text response. Returns "" if Gemini is not configured.
 */
export async function groundedQuery(prompt: string): Promise<string> {
  if (!env.geminiApiKey) return "";
  const res = await fetch(`${ENDPOINT}?key=${env.geminiApiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search_retrieval: {} }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini grounding failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? ""
  );
}
