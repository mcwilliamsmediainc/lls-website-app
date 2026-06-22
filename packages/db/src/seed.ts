/**
 * Seeds the initial team roster (spec Table 2).
 *
 * Each member gets a temporary password from env (SEED_DEFAULT_PASSWORD) or a
 * generated one printed to the console. MFA is enrolled on first login, so
 * totpSecret stays null here. Re-running is idempotent (upsert on username).
 *
 * Run with: pnpm db:seed
 */

import bcrypt from "bcryptjs";
import { getDb, teamMembers, type NewTeamMember, type TeamRole } from "./index.js";
import { sql } from "drizzle-orm";

interface SeedMember {
  name: string;
  role: TeamRole;
  email: string;
  username: string;
}

const ROSTER: SeedMember[] = [
  { name: "Matt McWilliams", role: "matt", email: "matt@mcwilliamsmedia.com", username: "matt" },
  { name: "Tiffany King", role: "tiffany", email: "tiffany@mcwilliamsmedia.com", username: "tiffany" },
  { name: "Elise Johnson", role: "elise", email: "elise@mcwilliamsmedia.com", username: "elise" },
  { name: "Chloe Brunner", role: "chloe", email: "chloe@mcwilliamsmedia.com", username: "chloe" },
  { name: "Penn", role: "penn", email: "penn@mcwilliamsmedia.com", username: "penn" },
  { name: "Rachelle Hoover", role: "rachelle", email: "rachelle@mcwilliamsmedia.com", username: "rachelle" },
  { name: "Clarence Villaroman", role: "clarence", email: "clarence@mcwilliamsmedia.com", username: "clarence" },
  { name: "Tyler", role: "tyler", email: "tyler@mcwilliamsmedia.com", username: "tyler" },
  { name: "Lindsay McWilliams", role: "lindsay", email: "lindsay@mcwilliamsmedia.com", username: "lindsay" },
];

async function main() {
  const db = getDb();
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? "ChangeMe-" + Math.random().toString(36).slice(2, 10);
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  for (const m of ROSTER) {
    const row: NewTeamMember = {
      name: m.name,
      role: m.role,
      email: m.email,
      username: m.username,
      passwordHash,
      active: true,
    };
    await db
      .insert(teamMembers)
      .values(row)
      .onConflictDoUpdate({
        target: teamMembers.username,
        set: { name: row.name, role: row.role, email: row.email },
      });
    console.log(`[seed] upserted ${m.username} (${m.role})`);
  }

  const count = await db.select({ n: sql<number>`count(*)::int` }).from(teamMembers);
  console.log(`[seed] team_members total: ${count[0]?.n ?? 0}`);
  if (!process.env.SEED_DEFAULT_PASSWORD) {
    console.log(`[seed] TEMPORARY PASSWORD for all seeded users: ${defaultPassword}`);
    console.log("[seed] Each user must change it and enroll MFA on first login.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
