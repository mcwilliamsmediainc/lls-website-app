/**
 * Content-phase orchestration.
 *
 * - Parses the page plan (services + service-area cities) from client-facts.md.
 * - Fans out generate_page jobs for the whole site.
 * - Chains generate_schema once a page passes the gate (with the generated
 *   markdown), and internal_linking + redirect_map once every content page for
 *   the client is approved.
 *
 * The build-content route kicks off the fan-out; the chain* helpers are invoked
 * from the worker content callbacks (upsert / approve) so the pipeline advances
 * itself without further human action.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db, jobs, contentPages } from "./db.js";
import { enqueueJob, type JobType } from "./queue.js";
import { getFileText, workspaceKey } from "./spaces.js";

export interface PageSpec {
  pageType: string;
  slug: string;
  title: string;
  params: Record<string, unknown>;
}

/** kebab-case a free-text label into a stable page slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/\[(VERIFY|PENDING)/i.test(s));
}

/**
 * Pull the service list (sub-verticals) and service-area cities out of
 * client-facts.md. Both are single comma-delimited lines in the Tier 1 block.
 */
export function parseBuildInputs(clientFacts: string): { services: string[]; serviceAreas: string[] } {
  const services = clientFacts.match(/\*\*Sub-verticals:\*\*\s*(.+)/i)?.[1] ?? "";
  const serviceAreas = clientFacts.match(/\*\*Service areas:\*\*\s*(.+)/i)?.[1] ?? "";
  return { services: cleanList(services), serviceAreas: cleanList(serviceAreas) };
}

/**
 * Build the full Phase-1 page plan: home, about, contact, one service page per
 * service, one location page per service-area city. Slugs are de-duplicated so a
 * service and a city that reduce to the same slug can't collide on the
 * (clientId, slug) unique index.
 */
export function buildPagePlan(services: string[], serviceAreas: string[]): PageSpec[] {
  const pages: PageSpec[] = [
    { pageType: "home", slug: "home", title: "Home", params: { pageType: "home", slug: "home", title: "Home" } },
    { pageType: "about", slug: "about", title: "About", params: { pageType: "about", slug: "about", title: "About" } },
    { pageType: "contact", slug: "contact", title: "Contact", params: { pageType: "contact", slug: "contact", title: "Contact" } },
  ];

  for (const service of services) {
    const slug = slugify(service);
    if (!slug) continue;
    pages.push({
      pageType: "service",
      slug,
      title: `Service: ${service}`,
      params: { pageType: "service", slug, service, title: `Service: ${service}` },
    });
  }

  for (const city of serviceAreas) {
    const slug = slugify(city);
    if (!slug) continue;
    pages.push({
      pageType: "location",
      slug,
      title: city,
      params: { pageType: "location", slug, city, title: city },
    });
  }

  const seen = new Set<string>();
  return pages.filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true)));
}

export interface EnqueueOpts {
  clientId: number;
  clientSlug: string;
  taskType: JobType;
  params: Record<string, unknown>;
  queuedBy?: number | null;
}

/** Insert a jobs row and enqueue it onto BullMQ. Returns the created jobs row. */
export async function enqueueClientJob(opts: EnqueueOpts) {
  const [job] = await db
    .insert(jobs)
    .values({
      clientId: opts.clientId,
      taskType: opts.taskType,
      status: "queued",
      queuedBy: opts.queuedBy ?? null,
      payload: opts.params,
    })
    .returning();
  if (!job) throw new Error("Failed to create job row");

  await enqueueJob({
    jobId: job.id,
    clientId: opts.clientId,
    clientSlug: opts.clientSlug,
    taskType: opts.taskType,
    params: opts.params,
  });
  return job;
}

/**
 * Queue generate_schema for a page that just passed the gate, passing the
 * generated markdown as pageContent. No-op if the gate hasn't passed, schema
 * already exists, the markdown isn't readable, or a schema job is already in
 * flight for this slug. Never throws — chaining must not break the worker
 * callback that triggers it.
 */
export async function chainSchemaForPage(
  clientId: number,
  clientSlug: string,
  page: { slug: string; pageType: string; gateStatus: string; schemaGenerated: boolean }
): Promise<void> {
  try {
    if (page.gateStatus !== "passing" || page.schemaGenerated) return;

    const inflight = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.clientId, clientId),
          eq(jobs.taskType, "generate_schema"),
          inArray(jobs.status, ["queued", "running"]),
          sql`${jobs.payload} ->> 'slug' = ${page.slug}`
        )
      )
      .limit(1);
    if (inflight.length) return;

    let pageContent = "";
    try {
      pageContent = await getFileText(workspaceKey(clientSlug, `pages/${page.slug}.md`));
    } catch {
      pageContent = "";
    }
    if (!pageContent.trim()) return;

    await enqueueClientJob({
      clientId,
      clientSlug,
      taskType: "generate_schema",
      params: { slug: page.slug, pageType: page.pageType, pageContent },
      queuedBy: null,
    });
  } catch (err) {
    console.error(`[orchestrator] chainSchemaForPage failed for ${clientSlug}/${page.slug}:`, err);
  }
}

/**
 * Once every (non-deleted) content page for a client is approved, queue
 * internal_linking and redirect_map — but only once. No-op if not all approved
 * or a linking pass is already queued/running/completed. Never throws.
 */
export async function chainLinkingAndRedirect(
  clientId: number,
  clientSlug: string,
  queuedBy?: number | null
): Promise<void> {
  try {
    const rows = await db.select().from(contentPages).where(eq(contentPages.clientId, clientId));
    const relevant = rows.filter((r) => !r.deletedAt);
    const allApproved = relevant.length > 0 && relevant.every((r) => r.status === "approved");
    if (!allApproved) return;

    const existing = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.clientId, clientId),
          eq(jobs.taskType, "internal_linking"),
          inArray(jobs.status, ["queued", "running", "completed"])
        )
      )
      .limit(1);
    if (existing.length) return;

    await enqueueClientJob({ clientId, clientSlug, taskType: "internal_linking", params: {}, queuedBy });
    await enqueueClientJob({ clientId, clientSlug, taskType: "redirect_map", params: {}, queuedBy });
  } catch (err) {
    console.error(`[orchestrator] chainLinkingAndRedirect failed for ${clientSlug}:`, err);
  }
}
