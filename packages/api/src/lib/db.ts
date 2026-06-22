/**
 * Drizzle + Supabase connection for the API.
 * Thin wrapper over the shared @lls/db client so the API has one import path.
 */

import { getDb, type Database } from "@lls/db";
import { env } from "./env.js";

export const db: Database = getDb(env.databaseUrl);
export type { Database };
export * from "@lls/db";
