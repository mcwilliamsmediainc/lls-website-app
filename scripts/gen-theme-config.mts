/**
 * Standalone driver for the config.php generator. Reads a client-facts.md file,
 * runs assembleThemeConfig for a given slug/vertical, and writes the rendered
 * config.php to stdout (or --out <path>). Live inputs that require the DB
 * (assigned photos, Brain Injection) can be injected as JSON via flags so the
 * generator can be exercised without a DB connection.
 *
 *   tsx scripts/gen-theme-config.mts --facts <md> --name "Truskett Law" \
 *       --site-type legal [--photos photos.json] [--brain brain.json] \
 *       [--mockup mockup.html] [--mockup-approved] --out config.generated.php
 */
import { readFileSync, writeFileSync } from "node:fs";
import { assembleThemeConfig, renderConfigPhp, configHeader } from "../packages/worker/src/lib/theme-config/index.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const factsPath = arg("facts");
const factsMd = factsPath ? readFileSync(factsPath, "utf8") : "";
const photos = arg("photos") ? JSON.parse(readFileSync(arg("photos")!, "utf8")) : [];
const brain = arg("brain") ? JSON.parse(readFileSync(arg("brain")!, "utf8")) : null;
const mockupPath = arg("mockup");
const mockup = mockupPath ? { approved: has("mockup-approved"), content: readFileSync(mockupPath, "utf8") } : null;

const result = assembleThemeConfig({
  businessName: arg("name"),
  siteType: arg("site-type") ?? "home_services",
  factsMd,
  mockup,
  brain,
  photos,
});

const slug = arg("slug") ?? "client";
const php = renderConfigPhp(result.config, configHeader(slug, result.sourced));

const out = arg("out");
if (out) writeFileSync(out, php);
else process.stdout.write(php);

process.stderr.write(
  JSON.stringify(
    { sourced: result.sourced, fellBack: result.fellBack, unverified: result.unverified },
    null,
    2
  ) + "\n"
);
