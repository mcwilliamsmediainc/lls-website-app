/**
 * Shared Drizzle client for the LLS workspace.
 *
 * Uses postgres-js. The same connection helper is consumed by the API and the
 * worker so there is exactly one place that owns connection configuration.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";
export { schema };

export type Database = PostgresJsDatabase<typeof schema>;

let singleton: Database | null = null;
let client: ReturnType<typeof postgres> | null = null;

/**
 * Returns a process-wide Drizzle instance. Safe to call repeatedly.
 *
 * @param connectionString defaults to process.env.DATABASE_URL
 */
export function getDb(connectionString = process.env.DATABASE_URL): Database {
  if (singleton) return singleton;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot create database client");
  }
  client = postgres(connectionString, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Supabase transaction pooler does not support prepared statements
  });
  singleton = drizzle(client, { schema });
  return singleton;
}

/** Closes the underlying connection pool. Used in tests and graceful shutdown. */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
    singleton = null;
  }
}
