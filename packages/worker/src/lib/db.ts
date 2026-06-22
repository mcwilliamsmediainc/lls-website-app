/**
 * Worker-side DB access (read-only use in handlers, e.g. resolving a client's
 * vertical). Writes that the team must audit go through the API callbacks instead.
 */

import { getDb, clients } from "@lls/db";
import { eq } from "drizzle-orm";

const db = getDb();

export async function getClientVertical(clientId: number): Promise<string> {
  const rows = await db.select({ siteType: clients.siteType }).from(clients).where(eq(clients.id, clientId)).limit(1);
  return rows[0]?.siteType ?? "home_services";
}

export async function getClientRow(clientId: number) {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return rows[0] ?? null;
}

export { db };
