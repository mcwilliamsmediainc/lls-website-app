/**
 * Extract the brand palette from an approved design mockup.
 *
 * The theme is driven by three brand colors (primary/navy, accent/orange,
 * sky) plus an optional extended palette of derived shades. A mockup expresses
 * these either as CSS custom properties (:root { --navy: #0B2545; ... }) or, at
 * minimum, as a set of hex colors we can rank. When nothing usable is found we
 * return null and the caller keeps the vertical base palette.
 */

export interface MockupColors {
  primary?: string;
  accent?: string;
  sky?: string;
  /** Any palette-token custom properties present (token => hex), e.g. sky-light. */
  palette?: Record<string, string>;
}

function normalizeHex(hex: string): string {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h.toUpperCase()}`;
}

/** Map a CSS custom-property name onto a theme palette token, if it is one. */
const TOKEN_ALIASES: Record<string, string> = {
  primary: "navy",
  brand: "navy",
  accent: "orange",
  secondary: "orange",
};

const PALETTE_TOKENS = new Set([
  "sky", "sky-light", "sky-pale", "mid", "navy", "navy-2", "slate", "cool",
  "line", "mist", "paper", "white", "ink", "orange", "orange-dk",
]);

export function extractMockupColors(mockup: string | null | undefined): MockupColors | null {
  if (!mockup) return null;

  const vars: Record<string, string> = {};
  const varRe = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g;
  for (let m = varRe.exec(mockup); m; m = varRe.exec(mockup)) {
    const name = (m[1] ?? "").toLowerCase();
    vars[TOKEN_ALIASES[name] ?? name] = normalizeHex(m[2] ?? "");
  }

  const palette: Record<string, string> = {};
  for (const [name, hex] of Object.entries(vars)) {
    if (PALETTE_TOKENS.has(name)) palette[name] = hex;
  }

  const result: MockupColors = {};
  if (vars.navy) result.primary = vars.navy;
  if (vars.orange) result.accent = vars.orange;
  if (vars.sky) result.sky = vars.sky;
  if (Object.keys(palette).length) result.palette = palette;

  if (result.primary || result.accent || result.sky || result.palette) return result;

  // No custom properties: fall back to the most frequent non-neutral hex colors.
  const counts = new Map<string, number>();
  const hexRe = /#[0-9a-fA-F]{6}\b/g;
  for (let m = hexRe.exec(mockup); m; m = hexRe.exec(mockup)) {
    const h = normalizeHex(m[0]);
    if (/^#(FFFFFF|000000|F{6}|0{6})$/.test(h)) continue;
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const primary = ranked[0];
  if (!primary) return null;
  return {
    primary,
    accent: ranked[1] ?? primary,
    sky: ranked[2] ?? ranked[1] ?? primary,
  };
}
