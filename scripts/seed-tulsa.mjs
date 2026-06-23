// One-off: seed Tulsa Kwik Dry as the first client, replicating the
// POST /api/clients route logic (client + intake checklist + brain-injection token).
import { randomBytes } from "node:crypto";
import { getDb, clients, checklistItems, llsBrainInjectionResponses } from "@lls/db";
import { eq } from "drizzle-orm";

const db = getDb(process.env.DATABASE_URL);

const slug = "tulsa-kwik-dry";
const services = ["Carpet Cleaning", "Water/Fire Restoration"];
const cities = ["Tulsa", "Broken Arrow", "Bixby", "Jenks", "Owasso", "Sand Springs", "Sapulpa", "Claremore"];

// Intake checklist template (mirrors STAGE_CHECKLISTS.intake + expandDynamicItems)
const intakeBase = [
  "site_scrape job complete",
  "gbp_verify job complete",
  "geo_research job complete (one per service area city)",
  "gap_report job complete",
  "client-facts.md reviewed by Elise",
  "Brain Injection submitted by client",
  "Brain Injection reviewed by team",
  "Intake approved — move to Content",
];
const items = [];
for (const name of intakeBase) {
  if (name.includes("one per service area city")) {
    for (const c of cities) items.push(name.replace("(one per service area city)", `(${c})`));
  } else {
    items.push(name);
  }
}

const existing = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, slug)).limit(1);
if (existing.length) {
  console.log(`SKIP: client '${slug}' already exists (id ${existing[0].id})`);
  process.exit(0);
}

const [client] = await db
  .insert(clients)
  .values({
    slug,
    businessName: "Tulsa Kwik Dry Total Cleaning",
    siteUrl: "https://tulsakwikdry.com",
    siteType: "home_services",
    tier: "tier_2",
    assignedTo: 1, // matt
    stage: "intake",
    stagingUrl: `${slug}.staging.locallaunchsystem.com`,
  })
  .returning();

await db.insert(checklistItems).values(
  items.map((itemName, idx) => ({ clientId: client.id, stage: "intake", itemName, sortOrder: idx }))
);

const responseToken = randomBytes(24).toString("hex");
await db.insert(llsBrainInjectionResponses).values({ clientId: client.id, responseToken, status: "pending" });

console.log(`CREATED client id=${client.id} slug=${client.slug}`);
console.log(`checklist items inserted: ${items.length}`);
console.log(`brain injection token: ${responseToken}`);
process.exit(0);
