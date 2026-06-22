/**
 * @lls/style-gate — the automated publish gate.
 *
 * Spec: the style gate is a programmatic HARD BLOCK, not a review step. A failed
 * gate prevents publish with no manual override (except the explicit
 * bypass_style_gate permission, handled at the route layer, never here).
 *
 * Checks:
 *  - Banned words (case-insensitive, whole-word / phrase)
 *  - Banned patterns (em dash, en dash, exclamation in body copy)
 *  - Word count within the page-type band
 *  - Reading level within the vertical target (Flesch-Kincaid Grade)
 *  - [VERIFY] flags are collected (they do not fail the gate but block approval)
 *
 * Rules are read from the repo-root `style-gate/` folder (rules.json,
 * word-count-targets.json), overridable via STYLE_GATE_DIR.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface StyleRules {
  banned_words: string[];
  banned_patterns: string[];
  verify_required_patterns: string[];
}

export type WordCountTargets = Record<string, { min: number; max: number }>;

export interface ReadingLevelTarget {
  /** Inclusive Flesch-Kincaid grade band, e.g. { min: 6, max: 7 }. */
  min: number;
  max: number;
}

export interface GateInput {
  content: string;
  /** Page type key, e.g. "service" | "home" | "location". */
  pageType: string;
  /** Optional explicit word-count override; otherwise looked up by pageType. */
  wordCountTarget?: { min: number; max: number };
  /** Optional reading-level band; if omitted, reading level is not enforced. */
  readingLevelTarget?: ReadingLevelTarget;
}

export interface GateViolation {
  kind: "banned_word" | "banned_pattern" | "word_count" | "reading_level";
  message: string;
}

export interface GateResult {
  pass: boolean;
  wordCount: number;
  readingGrade: number;
  violations: GateViolation[];
  /** [VERIFY] snippets found — do not fail the gate but block approval. */
  verifyFlags: string[];
  /** Phrases that should carry a [VERIFY] flag but appear unflagged. */
  unflaggedClaims: string[];
}

/* -------------------- rule loading -------------------- */

function findStyleGateDir(): string {
  if (process.env.STYLE_GATE_DIR) return process.env.STYLE_GATE_DIR;

  const candidates: string[] = [resolve(process.cwd(), "style-gate")];
  // Walk up from this module to find a repo-root style-gate/ dir.
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    candidates.push(resolve(dir, "style-gate"));
    dir = resolve(dir, "..");
  }
  for (const c of candidates) {
    if (existsSync(resolve(c, "rules.json"))) return c;
  }
  throw new Error(
    "Could not locate style-gate/rules.json. Set STYLE_GATE_DIR to the directory containing it."
  );
}

let cachedRules: StyleRules | null = null;
let cachedTargets: WordCountTargets | null = null;

export function loadRules(): StyleRules {
  if (cachedRules) return cachedRules;
  const dir = findStyleGateDir();
  cachedRules = JSON.parse(readFileSync(resolve(dir, "rules.json"), "utf8")) as StyleRules;
  return cachedRules;
}

export function loadWordCountTargets(): WordCountTargets {
  if (cachedTargets) return cachedTargets;
  const dir = findStyleGateDir();
  cachedTargets = JSON.parse(
    readFileSync(resolve(dir, "word-count-targets.json"), "utf8")
  ) as WordCountTargets;
  return cachedTargets;
}

/* -------------------- text analysis -------------------- */

/** Strips markdown so word counts and reading level reflect prose, not syntax. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // code fences
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/[*_>#-]/g, " ")
    .replace(/\[VERIFY\][^\n.]*/gi, " ") // remove verify annotations from prose stats
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text: string): number {
  const t = stripMarkdown(text);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = cleaned.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch-Kincaid Grade Level. */
export function fleschKincaidGrade(text: string): number {
  const prose = stripMarkdown(text);
  const sentences = prose.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = prose.split(/\s+/).filter(Boolean);
  if (words.length === 0 || sentences.length === 0) return 0;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const grade =
    0.39 * (words.length / sentences.length) +
    11.8 * (syllables / words.length) -
    15.59;
  return Math.round(grade * 10) / 10;
}

/* -------------------- the gate -------------------- */

export function runStyleGate(input: GateInput): GateResult {
  const rules = loadRules();
  const targets = loadWordCountTargets();
  const violations: GateViolation[] = [];

  const lower = input.content.toLowerCase();

  // Banned words / phrases (word-boundary aware).
  for (const word of rules.banned_words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");
    if (re.test(lower)) {
      violations.push({ kind: "banned_word", message: `Banned word/phrase: "${word}"` });
    }
  }

  // Banned patterns (em dash, en dash, exclamation in body copy).
  for (const pattern of rules.banned_patterns) {
    let re: RegExp;
    try {
      re = new RegExp(pattern, "g");
    } catch {
      continue; // skip malformed pattern rather than crash the gate
    }
    if (re.test(input.content)) {
      const label =
        pattern === "—" ? "em dash" : pattern === "–" ? "en dash" : "exclamation point in body copy";
      violations.push({ kind: "banned_pattern", message: `Banned pattern (${label})` });
    }
  }

  // Word count band.
  const wordCount = countWords(input.content);
  const target = input.wordCountTarget ?? targets[input.pageType];
  if (target) {
    if (wordCount < target.min) {
      violations.push({
        kind: "word_count",
        message: `Word count ${wordCount} below minimum ${target.min} for page type "${input.pageType}"`,
      });
    } else if (wordCount > target.max) {
      violations.push({
        kind: "word_count",
        message: `Word count ${wordCount} above maximum ${target.max} for page type "${input.pageType}"`,
      });
    }
  }

  // Reading level (optional).
  const readingGrade = fleschKincaidGrade(input.content);
  if (input.readingLevelTarget) {
    const { min, max } = input.readingLevelTarget;
    if (readingGrade < min || readingGrade > max) {
      violations.push({
        kind: "reading_level",
        message: `Reading grade ${readingGrade} outside target band ${min}-${max}`,
      });
    }
  }

  // [VERIFY] flags present in the content.
  const verifyFlags = Array.from(input.content.matchAll(/\[VERIFY\]([^\n]*)/gi)).map((m) =>
    (m[1] ?? "").trim()
  );

  // Claims that look like they need a [VERIFY] but are not flagged.
  const unflaggedClaims: string[] = [];
  for (const pat of rules.verify_required_patterns) {
    const escaped = pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`[^.\\n]*\\b${escaped}\\b[^.\\n]*`, "gi");
    for (const m of input.content.matchAll(re)) {
      const sentence = m[0] ?? "";
      if (!/\[VERIFY\]/i.test(sentence)) {
        unflaggedClaims.push(sentence.trim());
      }
    }
  }

  return {
    pass: violations.length === 0,
    wordCount,
    readingGrade,
    violations,
    verifyFlags,
    unflaggedClaims,
  };
}

/** Convenience: summarize violations into a single gate_failure_reason string. */
export function summarizeFailure(result: GateResult): string | null {
  if (result.pass) return null;
  return result.violations.map((v) => v.message).join("; ");
}
