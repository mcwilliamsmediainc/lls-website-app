/**
 * Loads prompt templates from the repo-root prompts/ folder and injects context.
 * Placeholders use {snake_case} tokens. Unfilled tokens are left as-is so missing
 * context is visible in logs rather than silently dropped.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function findPromptsDir(): string {
  if (process.env.PROMPTS_DIR) return process.env.PROMPTS_DIR;
  const candidates: string[] = [resolve(process.cwd(), "prompts")];
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    candidates.push(resolve(dir, "prompts"));
    dir = resolve(dir, "..");
  }
  for (const c of candidates) {
    if (existsSync(resolve(c, "generate-page-service.md"))) return c;
  }
  throw new Error("Could not locate prompts/ directory. Set PROMPTS_DIR.");
}

const cache = new Map<string, string>();

export function loadPrompt(name: string): string {
  const file = name.endsWith(".md") ? name : `${name}.md`;
  if (cache.has(file)) return cache.get(file)!;
  const dir = findPromptsDir();
  const content = readFileSync(resolve(dir, file), "utf8");
  cache.set(file, content);
  return content;
}

export function renderPrompt(name: string, vars: Record<string, string>): string {
  let out = loadPrompt(name);
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}
