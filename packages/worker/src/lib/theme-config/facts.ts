/**
 * Tier 1 parser for client-facts.md.
 *
 * Pulls the confirmed identity / NAP fields the theme config needs out of the
 * harvested client-facts.md. Only Tier 1 (the "Harvested, client confirms"
 * section) is read here; Tier 2/3 are not config inputs. [VERIFY] / [PENDING]
 * annotations and trailing "(confirmed)" notes are stripped from the value but
 * their presence is surfaced so the deploy step can flag unconfirmed NAP.
 */

export interface ParsedAddress {
  full: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface ParsedFacts {
  businessName?: string;
  vertical?: string;
  phone?: string;
  email?: string;
  address?: ParsedAddress;
  hoursShort?: string;
  /** slug => label, in the order listed under "Service areas". */
  locations?: Record<string, string>;
  region?: string;
  /** Field names that still carried a [VERIFY]/[PENDING] flag in Tier 1. */
  unverified: string[];
}

const DAY_NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", tues: "Tuesday", wed: "Wednesday", thu: "Thursday",
  thur: "Thursday", thurs: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

/** Normalize terse harvested hours ("Mon-Fri 8am-5pm") into presentable copy. */
export function normalizeHours(raw: string): string {
  let s = raw.trim();
  const day = (abbr: string) => DAY_NAMES[abbr.toLowerCase().replace(/\.$/, "")] ?? abbr;
  // Day range: Mon-Fri -> Monday to Friday
  s = s.replace(/\b([A-Za-z]{3,5})\s*[-–]\s*([A-Za-z]{3,5})\b/g, (m, a, b) => {
    const da = day(a), db = day(b);
    return da !== a || db !== b ? `${da} to ${db}` : m;
  });
  // Times: 8am -> 8 AM, 8:30pm -> 8:30 PM
  s = s.replace(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/gi, (_m, h, min, ap) =>
    `${h}${min ? `:${min}` : ""} ${ap.toUpperCase()}M`
  );
  // Time range separator: "8 AM-5 PM" -> "8 AM to 5 PM"
  s = s.replace(/(\d\s?[AP]M)\s*[-–]\s*(\d)/g, "$1 to $2");
  // Put a comma between the day clause and the time clause when both are present.
  s = s.replace(/(day|days)\s+(\d)/i, "$1, $2");
  return s.replace(/\s{2,}/g, " ").trim();
}

/** Slugify a label the same way the theme's location slugs are formed. */
export function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Strip [VERIFY]/[PENDING] flags and trailing "(confirmed)" annotations. */
function clean(value: string): { value: string; flagged: boolean } {
  const flagged = /\[VERIFY\]|\[PENDING\]/i.test(value);
  const cleaned = value
    .replace(/\[VERIFY[^\]]*\]/gi, "")
    .replace(/\[PENDING[^\]]*\]/gi, "")
    .replace(/\((?:confirmed|verified)\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[\s,;]+$/, "")
    .trim();
  return { value: cleaned, flagged };
}

/** Isolate the Tier 1 block so a label in a later tier can't shadow a Tier 1 one. */
function tier1Block(md: string): string {
  const start = md.search(/##\s*Tier\s*1\b/i);
  if (start === -1) return md;
  const rest = md.slice(start + 1);
  const nextHeading = rest.search(/\n##\s/);
  return nextHeading === -1 ? md.slice(start) : md.slice(start, start + 1 + nextHeading);
}

/**
 * Read a `- **Label:** value` bullet. `label` is matched case-insensitively and
 * the separator between words is flexible (space, hyphen, or em dash) so both
 * "NAP — address" and "NAP address" resolve.
 */
function field(block: string, label: string): string | undefined {
  const pattern = label
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s\\u2014\\-]+");
  const re = new RegExp(`^\\s*[-*]\\s*\\*\\*\\s*${pattern}\\s*:?\\s*\\*\\*\\s*(.+?)\\s*$`, "im");
  const m = block.match(re);
  return m?.[1] ? m[1].trim() : undefined;
}

/** "2921 East 91st Street, Suite 100, Tulsa, OK 74137" -> structured parts. */
export function parseAddress(full: string): ParsedAddress {
  const parts = full.split(",").map((p) => p.trim()).filter(Boolean);
  let street = full, city = "", state = "", zip = "";
  const last = parts[parts.length - 1] ?? "";
  const sz = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (sz && parts.length >= 3) {
    state = (sz[1] ?? "").toUpperCase();
    zip = sz[2] ?? "";
    city = parts[parts.length - 2] ?? "";
    street = parts.slice(0, parts.length - 2).join(", ");
  }
  return { full, street, city, state, zip };
}

export function parseClientFacts(md: string): ParsedFacts {
  const block = tier1Block(md || "");
  const unverified: string[] = [];

  const take = (label: string, key: string): string | undefined => {
    const raw = field(block, label);
    if (raw === undefined) return undefined;
    const { value, flagged } = clean(raw);
    if (flagged) unverified.push(key);
    return value || undefined;
  };

  const businessName = take("Business name", "business_name");
  const verticalRaw = take("Primary vertical", "vertical") ?? take("Site type", "vertical");
  const vertical = verticalRaw
    ? verticalRaw.toLowerCase().replace(/[\s/]+/g, "_").replace(/[^a-z_]/g, "")
    : undefined;
  const phone = take("NAP phone", "phone") ?? take("phone", "phone");
  const email = take("NAP email", "email") ?? take("email", "email");
  const addressStr = take("NAP address", "address") ?? take("address", "address");
  const hoursRaw = take("Hours", "hours");
  const hoursShort = hoursRaw ? normalizeHours(hoursRaw) : undefined;
  const location = take("Location city state", "location") ?? take("Location", "location");

  let locations: Record<string, string> | undefined;
  const areas = take("Service areas", "service_areas") ?? take("Service area cities", "service_areas");
  if (areas) {
    locations = {};
    for (const label of areas.split(",").map((s) => s.trim()).filter(Boolean)) {
      locations[slugify(label)] = label;
    }
    if (Object.keys(locations).length === 0) locations = undefined;
  }

  // Region: the state name from the location line, if present.
  let region: string | undefined;
  if (location) {
    const seg = location.split(",").map((s) => s.trim());
    region = seg.length > 1 ? seg[seg.length - 1] : undefined;
  }

  return {
    businessName,
    vertical,
    phone,
    email,
    address: addressStr ? parseAddress(addressStr) : undefined,
    hoursShort,
    locations,
    region,
    unverified,
  };
}
