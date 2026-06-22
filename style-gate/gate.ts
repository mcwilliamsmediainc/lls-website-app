/**
 * Style gate CLI runner.
 *
 * Usage:
 *   pnpm gate <file-or-dir> [--page-type=service] [--grade=6-7]
 *
 * Scans markdown files, runs the automated style gate, prints violations, and
 * exits non-zero if any file fails — so it can run in CI or a pre-push hook.
 * Page type is inferred from the filename when not passed (home.md -> "home").
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, basename, extname, join } from "node:path";
import { runStyleGate, type GateResult } from "../packages/style-gate/src/index.js";

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      flags[k!] = v ?? "true";
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function collectMarkdown(target: string): string[] {
  const st = statSync(target);
  if (st.isFile()) return [target];
  const out: string[] = [];
  for (const entry of readdirSync(target)) {
    const full = join(target, entry);
    if (statSync(full).isDirectory()) out.push(...collectMarkdown(full));
    else if (extname(full) === ".md") out.push(full);
  }
  return out;
}

function inferPageType(file: string): string {
  const name = basename(file, ".md").toLowerCase();
  if (name.includes("home")) return "home";
  if (name.includes("service-hub") || name.includes("services")) return "service-hub";
  if (name.includes("service")) return "service";
  if (name.includes("location")) return "location";
  if (name.includes("about")) return "about";
  if (name.includes("contact")) return "contact";
  if (name.includes("faq")) return "faq";
  return "service";
}

function parseGrade(flag?: string) {
  if (!flag) return undefined;
  const [min, max] = flag.split("-").map(Number);
  if (Number.isFinite(min) && Number.isFinite(max)) return { min: min!, max: max! };
  return undefined;
}

function printResult(file: string, r: GateResult) {
  const status = r.pass ? "PASS" : "FAIL";
  console.log(`\n[${status}] ${file}`);
  console.log(`  words: ${r.wordCount}  grade: ${r.readingGrade}`);
  for (const v of r.violations) console.log(`  ✗ ${v.message}`);
  if (r.verifyFlags.length) console.log(`  [VERIFY] flags: ${r.verifyFlags.length}`);
  if (r.unflaggedClaims.length) {
    console.log(`  ! ${r.unflaggedClaims.length} claim(s) may need [VERIFY]:`);
    for (const c of r.unflaggedClaims.slice(0, 5)) console.log(`      - ${c.slice(0, 100)}`);
  }
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const target = positional[0];
  if (!target) {
    console.error("Usage: pnpm gate <file-or-dir> [--page-type=service] [--grade=6-7]");
    process.exit(2);
  }
  const grade = parseGrade(flags.grade);
  const files = collectMarkdown(resolve(target));
  if (!files.length) {
    console.error("No .md files found at", target);
    process.exit(2);
  }

  let failures = 0;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const pageType = flags["page-type"] ?? inferPageType(file);
    const result = runStyleGate({ content, pageType, readingLevelTarget: grade });
    printResult(file, result);
    if (!result.pass) failures++;
  }

  console.log(`\n${files.length - failures}/${files.length} files passed the style gate.`);
  process.exit(failures > 0 ? 1 : 0);
}

main();
