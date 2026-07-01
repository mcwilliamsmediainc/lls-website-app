/**
 * Per-vertical base templates for the lls-local-40 theme config.
 *
 * These hold the structural + editorial defaults that are NOT (yet) sourced from
 * the client data pipeline: CTA copy, disclaimers, fonts, the derived palette
 * shades, and the services/testimonials scaffold. The generator (index.ts)
 * overlays the client's live identity, NAP, colors, vertical, locations,
 * attorney, and image zones on top of the matching base.
 *
 * The `legal` base is seeded from the Truskett Law reference build (the first
 * legal Local 40 site) so regenerating Truskett reproduces its config; the
 * client-specific slots (business identity, attorney, image IDs) are overridden
 * from live data and left at their reference values only as a last-resort
 * fallback when the pipeline has produced nothing for that client yet.
 */

import type { PhpValue } from "./render.js";

export type ThemeConfig = { [k: string]: PhpValue };

const legal: ThemeConfig = {
  /* Business identity (overridden from client-facts.md + client row) */
  business_name: "Truskett Law",
  tagline: "Tulsa Personal Injury Attorneys",
  logo_text: "Truskett Law",
  logo_letter: "T",
  phone: "(918) 392-5444",
  email: "john@truskettlaw.com",
  address: "2921 East 91st Street, Suite 100, Tulsa, OK 74137",
  address_parts: {
    street: "2921 East 91st Street, Suite 100",
    city: "Tulsa",
    state: "OK",
    zip: "74137",
  },
  map_query: "2921 East 91st Street, Suite 100, Tulsa, OK 74137",
  hours: "Calls Answered 24/7",
  hours_short: "Monday to Friday, 8 AM to 5 PM",
  answered_line: "Here to Help You",
  reviews_count: "300+",
  reviews_rating: "5",
  years_experience: "20+",

  /* Vertical + calls to action */
  vertical: "legal",
  cta_primary: "Free Consultation",
  cta_secondary: "Get a Free Case Review",
  form_disclaimer:
    "By submitting you agree to be contacted about your inquiry. Not legal advice; no attorney-client relationship is formed.",
  sidecard_title: "Injured? Talk to us free.",
  sidecard_button: "Request Free Review",
  ctaband_button: "Request a Free Consultation",
  hero_eyebrow: "Tulsa Personal Injury Attorneys",
  fee_disclaimer: "No fee unless we win",

  slogan_lead: "Don't Risk It,",
  slogan_brand: "Truskett.",
  cta_band_sub: "Free consultation &middot; No fee unless we win &middot; Calls answered 24/7",

  /* Colors (color_primary/accent/sky + palette overridden from the approved mockup) */
  color_primary: "#0B2545",
  color_accent: "#F7941D",
  color_sky: "#3FA8EF",

  palette: {
    sky: "#3FA8EF",
    "sky-light": "#8FCBF4",
    "sky-pale": "#DCEEFB",
    mid: "#1D6FB8",
    navy: "#0B2545",
    "navy-2": "#0E2F57",
    slate: "#4D4D4D",
    cool: "#6B7682",
    line: "#DEE5EC",
    mist: "#EEF3F7",
    paper: "#F7FAFC",
    white: "#FFFFFF",
    ink: "#0D0D0D",
    orange: "#F7941D",
    "orange-dk": "#E07E0A",
  },

  fonts: {
    heading: '"Source Serif 4", Georgia, serif',
    body: '"Public Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    google:
      "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=Public+Sans:wght@400;500;600;700;800&display=swap",
  },

  /* Attorney / lead team member (bio enriched from Brain Injection when present) */
  attorney_name: "John Truskett",
  attorney_title: "Personal Injury Attorney",
  attorney: {
    name: "John Truskett",
    title: "Personal Injury Attorney",
    since: "2004",
    bio: "John Truskett has focused his practice on personal injury law since graduating law school in 2004. The firm represents injured people and families across the Tulsa area on a contingency basis, which means clients pay no attorney fee unless the firm recovers compensation for them.",
  },

  /* Image zones (WordPress attachment IDs; overridden from assigned photos, 0 = unassigned) */
  img_hero: 486,
  img_attorney: 640,
  img_office: 484,
  img_lobby: 479,
  img_team: 603,

  services: {
    "personal-injury": "Personal Injury",
    "motor-vehicle-accidents": "Motor Vehicle Accidents",
    "semi-truck-accidents": "Semi-Truck Accidents",
    "motorcycle-accidents": "Motorcycle Accidents",
    "pedestrian-injury": "Pedestrian Injury",
    "slip-and-fall": "Slip and Fall",
    "nursing-home-negligence-and-abuse": "Nursing Home Negligence",
    "wrongful-death": "Wrongful Death",
    "birth-injury": "Birth Injury",
    "catastrophic-injury": "Catastrophic Injury",
    "defective-products": "Defective Products",
    "surgical-injury": "Surgical Injury",
    "animal-dog-bite-injury": "Dog Bite Injury",
    "insurance-disputes": "Insurance Disputes",
  },

  signature_service: {
    slug: "semi-truck-accidents",
    label: "Semi-Truck &amp; 18-Wheeler Wrecks",
    note: "Signature practice",
  },

  locations: {
    tulsa: "Tulsa",
    "broken-arrow": "Broken Arrow",
    owasso: "Owasso",
    jenks: "Jenks",
    "sand-springs": "Sand Springs",
    claremore: "Claremore",
    bixby: "Bixby",
    sapulpa: "Sapulpa",
    glenpool: "Glenpool",
    coweta: "Coweta",
    catoosa: "Catoosa",
    collinsville: "Collinsville",
    skiatook: "Skiatook",
    wagoner: "Wagoner",
    inola: "Inola",
    "fair-oaks": "Fair Oaks",
    avants: "Avants",
    beggs: "Beggs",
  },
  region: "Oklahoma",
  metro: "the Tulsa metro",

  case_types: [
    "Car Accident",
    "Truck Accident",
    "Motorcycle Accident",
    "Pedestrian Injury",
    "Slip and Fall",
    "Nursing Home Abuse",
    "Wrongful Death",
    "Other Injury",
  ],
  service_types: ["Repair", "Installation", "Maintenance", "Emergency Service", "Free Estimate", "Other"],

  testimonials: [
    {
      text: "The insurance company denied my claim and my employer fired me after my crash. John fought for my rights and even won on appeal. They are real trial attorneys who care about people, not just money.",
      who: "Jon W., Tulsa",
    },
    {
      text: "While other attorneys only call, Mr. Truskett took the time to meet with me in person and handled my injury case as a top priority. I recommend him to anyone.",
      who: "Fannie B., Tulsa",
    },
    {
      text: "John is an amazing attorney. He has his client's best interest in mind when handling a case. I would gladly refer him any chance I get.",
      who: "Tiffany T., Tulsa",
    },
  ],

  footer_blurb:
    "Truskett Law represents injured people and families across the Tulsa area, handling the legal side so you can focus on recovery. No fee unless we recover for you.",
  footer_practice: {
    "semi-truck-accidents": "Semi-Truck Wrecks",
    "motor-vehicle-accidents": "Car Wreck Injuries",
    "wrongful-death": "Wrongful Death",
    "catastrophic-injury": "Catastrophic Injury",
    "nursing-home-negligence-and-abuse": "Nursing Home Negligence",
  },
  footer_legal:
    "Attorney advertising. The information on this site is for general purposes only and is not legal advice. Viewing it does not create an attorney-client relationship. Prior results do not guarantee a similar outcome; every case is different.",
  footer_credit: "Site by McWilliams Media",
  social: [],
};

const BASES: Record<string, ThemeConfig> = { legal };

/**
 * Deep-clone the base template for a vertical. Falls back to the legal base
 * (the only fully-specified template today) for verticals without their own.
 */
export function verticalBase(vertical: string): ThemeConfig {
  const base = BASES[vertical] ?? legal;
  return structuredClone(base);
}
