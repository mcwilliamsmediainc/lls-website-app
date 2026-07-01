/**
 * Render a JS config value to a PHP `config.php` the lls-local-40 theme can
 * `require`. Output mirrors the hand-written config.php: a returned array using
 * array(...) syntax, single-quoted strings, associative keys as 'k' => v.
 */

export type PhpValue = string | number | boolean | null | PhpValue[] | { [k: string]: PhpValue };

function phpString(s: string): string {
  // Single-quoted PHP strings only interpret \\ and \'. Everything else
  // (including HTML entities like &amp; and &middot;) is literal.
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function isPlainObject(v: PhpValue): v is { [k: string]: PhpValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function render(value: PhpValue, indent: number): string {
  const pad = "    ".repeat(indent);
  const padIn = "    ".repeat(indent + 1);

  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return phpString(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "array()";
    // A list of scalars renders inline for readability; anything nested goes multi-line.
    const scalarOnly = value.every((v) => typeof v !== "object" || v === null);
    if (scalarOnly) {
      return `array(${value.map((v) => render(v, 0)).join(", ")})`;
    }
    const items = value.map((v) => `${padIn}${render(v, indent + 1)},`);
    return `array(\n${items.join("\n")}\n${pad})`;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return "array()";
    const items = keys.map((k) => `${padIn}${phpString(k)} => ${render(value[k] ?? null, indent + 1)},`);
    return `array(\n${items.join("\n")}\n${pad})`;
  }

  return "null";
}

/** Render the top-level config object to a complete config.php file. */
export function renderConfigPhp(config: { [k: string]: PhpValue }, header = ""): string {
  const banner = header
    ? `/**\n${header
        .split("\n")
        .map((l) => ` * ${l}`.replace(/\s+$/, ""))
        .join("\n")}\n */\n\n`
    : "";
  return `<?php\n${banner}if (!defined('ABSPATH')) exit;\n\nreturn ${render(config, 0)};\n`;
}
