/**
 * Worker-side DB access (read-only use in handlers, e.g. resolving a client's
 * vertical). Writes that the team must audit go through the API callbacks instead.
 */

import { getDb, clients, photos, llsBrainInjectionResponses } from "@lls/db";
import { and, eq, isNull } from "drizzle-orm";

const db = getDb();

export async function getClientVertical(clientId: number): Promise<string> {
  const rows = await db.select({ siteType: clients.siteType }).from(clients).where(eq(clients.id, clientId)).limit(1);
  return rows[0]?.siteType ?? "home_services";
}

export async function getClientRow(clientId: number) {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return rows[0] ?? null;
}

/** Non-deleted photos assigned to a page zone, for the theme image-zone mapping. */
export async function getAssignedPhotos(clientId: number) {
  return db
    .select({
      id: photos.id,
      filename: photos.filename,
      category: photos.category,
      zoneType: photos.zoneType,
      pageAssigned: photos.pageAssigned,
      altText: photos.altText,
      generationMetadata: photos.generationMetadata,
    })
    .from(photos)
    .where(and(eq(photos.clientId, clientId), isNull(photos.deletedAt)));
}

/** Latest Brain Injection (Tier 3) response for a client, if any. */
export async function getBrainInjection(clientId: number) {
  const rows = await db
    .select({
      status: llsBrainInjectionResponses.status,
      proudOf: llsBrainInjectionResponses.proudOf,
      differentiator: llsBrainInjectionResponses.differentiator,
      additionalNotes: llsBrainInjectionResponses.additionalNotes,
    })
    .from(llsBrainInjectionResponses)
    .where(eq(llsBrainInjectionResponses.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

export { db };
