/**
 * image_harvest — pull a client's existing imagery into the workspace and
 * categorize it. This is the imagery-sourcing stage that feeds the Photo Manager
 * (client photos are tier 1 of the image hierarchy: client -> GBP -> AI -> stock).
 *
 * Two intake paths, chosen by managed_hosting:
 *
 *  - Managed (managed_hosting=true): SSH into the client's WordPress box with the
 *    lls-infra-key as server_user, list the media library via WP-CLI, and pull each
 *    image's bytes over SFTP.
 *  - External (managed_hosting=false): crawl the public site, collect <img> tags,
 *    and download images over HTTP, skipping icons / tiny (<50KB) images.
 *
 * Both paths then:
 *  - store every image in MinIO at workspace/<slug>/images/harvested/<filename>
 *  - classify each image with Claude (hero | team | office | service | location |
 *    logo | other) from its filename, alt text, and metadata descriptor
 *  - write workspace/<slug>/images/harvest-manifest.json (category, original URL,
 *    suggested placeholder zones)
 *  - register a photos row (source=client) per harvested image
 *  - mark the "Image harvest complete" checklist item done
 *
 * Failure modes mirror wp_intake: SSH / WP-CLI unavailable -> needs_review;
 * an individual image that fails to download or classify is logged and skipped.
 */

import { readFileSync } from "node:fs";
import { basename, posix } from "node:path";
import { Client } from "ssh2";
import type { ConnectConfig, SFTPWrapper } from "ssh2";
import * as cheerio from "cheerio";
import { callClaude, parseJsonOutput } from "../lib/anthropic.js";
import { api } from "../lib/apiClient.js";
import { getClientRow } from "../lib/db.js";
import { env } from "../lib/env.js";
import { type JobHandler, type HandlerResult } from "../lib/types.js";

/** Categories Claude must choose from (also the photo zone_type stored per image). */
const CATEGORIES = ["hero", "team", "office", "service", "location", "logo", "other"] as const;
type Category = (typeof CATEGORIES)[number];

/** Suggested placeholder zones per category, surfaced in the manifest for the team. */
const ZONE_SUGGESTIONS: Record<Category, string[]> = {
  hero: ["hero_banner", "page_header"],
  team: ["about_team", "team_grid"],
  office: ["about_office", "gallery"],
  service: ["service_feature", "gallery"],
  location: ["location_feature", "service_area"],
  logo: ["header_logo", "footer_logo"],
  other: ["gallery"],
};

/** Max images harvested per run, to keep the job bounded. */
const MAX_IMAGES = 1000;
/** Skip images smaller than this on external scrape (icons, sprites, spacers). */
const MIN_EXTERNAL_BYTES = 50 * 1024;
/** Hard cap on a single image so a base64 callback stays under the API body limit. */
const MAX_IMAGE_BYTES = 18 * 1024 * 1024;
/** Pages to crawl when scraping <img> tags from an external site. */
const MAX_SCRAPE_PAGES = 25;

interface HarvestImage {
  /** Filename as stored in MinIO under images/harvested/. */
  filename: string;
  storedPath: string;
  originalUrl: string;
  altText: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  /** WordPress media ID (managed path only). */
  wpMediaId?: number;
  category?: Category;
}

/* ------------------------------------------------------------------ SSH ---- */

interface CmdResult {
  code: number;
  stdout: string;
  stderr: string;
}

function sshConnect(cfg: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("error", (err) => reject(err))
      .connect(cfg);
  });
}

function sshExec(conn: Client, cmd: string): Promise<CmdResult> {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream
        .on("close", (code: number | null) => resolve({ code: code ?? 0, stdout, stderr }))
        .on("data", (d: Buffer) => {
          stdout += d.toString();
        })
        .stderr.on("data", (d: Buffer) => {
          stderr += d.toString();
        });
    });
  });
}

function openSftp(conn: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
  });
}

function sftpReadFile(sftp: SFTPWrapper, path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    sftp.readFile(path, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function tryJson<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- helpers -- */

/** Sanitize a basename into a safe, unique-ish MinIO key segment. */
function safeName(name: string, fallback: string): string {
  const clean = name.replace(/[?#].*$/, "").trim().replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return clean || fallback;
}

/** Map a WP/HTTP mime type to a file extension when the URL has none. */
function extForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
  };
  return map[mime.toLowerCase()] ?? "";
}

/* ----------------------------------------------------------- managed path -- */

interface WpMedia {
  ID: number;
  file?: string;
  url?: string;
  title?: string;
  alt_text?: string;
  post_mime_type?: string;
}

async function harvestManaged(
  client: NonNullable<Awaited<ReturnType<typeof getClientRow>>>,
  slug: string,
  log: string[]
): Promise<{ images: HarvestImage[]; needsReview?: string }> {
  const host = client.serverHost;
  const user = client.serverUser;
  const serverPath = client.serverPath;
  if (!host || !user || !serverPath) {
    const missing = [!host && "server_host", !user && "server_user", !serverPath && "server_path"].filter(Boolean).join(", ");
    return { images: [], needsReview: `image_harvest (managed) needs server_host, server_user, server_path; missing: ${missing}` };
  }

  let privateKey: Buffer;
  try {
    privateKey = readFileSync(env.sshKeyPath);
  } catch (err) {
    return { images: [], needsReview: `SSH key not readable at ${env.sshKeyPath}: ${err instanceof Error ? err.message : String(err)}` };
  }

  let conn: Client;
  try {
    conn = await sshConnect({ host, port: 22, username: user, privateKey, readyTimeout: 20_000 });
  } catch (err) {
    return { images: [], needsReview: `SSH connection to ${user}@${host} failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  try {
    log.push(`SSH connected to ${user}@${host}`);
    const P = serverPath;
    // --skip-plugins --skip-themes keeps theme/plugin PHP notices (e.g. the Bridge
    // theme's magic-method warnings under PHP 8) out of stdout so it stays clean JSON.
    // Media is core, so skipping them does not affect the listing.
    const wp = `${env.wpCli} --skip-plugins --skip-themes`;

    // Enumerate image attachments. WP-CLI has no `media list` subcommand, so query
    // the attachment posts via `wp eval`, returning the same fields (ID, file, url,
    // title, alt_text, post_mime_type) the spec asks for. `file` is relative to the
    // uploads basedir; `url` is the public URL.
    const evalPhp =
      '$q=get_posts(array("post_type"=>"attachment","post_mime_type"=>"image","numberposts"=>-1,"post_status"=>"inherit"));' +
      '$o=array();foreach($q as $p){$o[]=array("ID"=>$p->ID,"file"=>get_post_meta($p->ID,"_wp_attached_file",true),' +
      '"url"=>wp_get_attachment_url($p->ID),"title"=>$p->post_title,' +
      '"alt_text"=>get_post_meta($p->ID,"_wp_attachment_image_alt",true),"post_mime_type"=>$p->post_mime_type);}' +
      'echo json_encode($o);';
    const list = await sshExec(conn, `${wp} eval '${evalPhp}' --path=${P}`);
    const wpCliUnavailable =
      list.code === 127 ||
      /command not found|not found|No such file|WP-CLI requires PHP|Error establishing/i.test(list.stderr) ||
      (list.code !== 0 && list.stdout.trim() === "");
    if (wpCliUnavailable) {
      return {
        images: [],
        needsReview: `WP-CLI media enumeration not usable on ${host} (path ${P}, exit ${list.code}): ${list.stderr.trim().slice(0, 300) || "no output"}. Check WP_CLI_BIN or harvest manually.`,
      };
    }

    const media = (tryJson<WpMedia[]>(list.stdout) ?? []).filter((m) => (m.post_mime_type ?? "").startsWith("image/"));
    log.push(`Media library: ${media.length} image attachment(s)`);

    // Resolve the uploads base directory so SFTP paths are correct even on
    // non-standard layouts; fall back to the conventional path.
    const baseDirRes = await sshExec(conn, `${wp} eval 'echo wp_get_upload_dir()["basedir"];' --path=${P}`);
    const uploadsBase = baseDirRes.code === 0 && baseDirRes.stdout.trim() ? baseDirRes.stdout.trim() : posix.join(P, "wp-content/uploads");

    const images: HarvestImage[] = [];
    const usedNames = new Set<string>();
    const sftp = await openSftp(conn);

    for (const m of media) {
      if (images.length >= MAX_IMAGES) {
        log.push(`Reached MAX_IMAGES (${MAX_IMAGES}); skipping remaining ${media.length - images.length} attachment(s)`);
        break;
      }
      if (!m.file) continue;
      const remotePath = posix.join(uploadsBase, m.file);
      let bytes: Buffer;
      try {
        bytes = await sftpReadFile(sftp, remotePath);
      } catch (err) {
        log.push(`Skip media ${m.ID} (${m.file}): SFTP read failed: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      if (bytes.length > MAX_IMAGE_BYTES) {
        log.push(`Skip media ${m.ID} (${m.file}): ${(bytes.length / 1024 / 1024).toFixed(1)}MB exceeds cap`);
        continue;
      }
      const mime = m.post_mime_type ?? "image/jpeg";
      let fname = safeName(basename(m.file), `media-${m.ID}`);
      if (!/\.[a-z0-9]+$/i.test(fname)) fname += extForMime(mime);
      // Prefix with the media ID so files from different upload folders can't collide.
      fname = `${m.ID}-${fname}`;
      if (usedNames.has(fname)) continue;
      usedNames.add(fname);

      images.push({
        filename: fname,
        storedPath: `images/harvested/${fname}`,
        originalUrl: m.url ?? remotePath,
        altText: m.alt_text ?? "",
        title: m.title ?? "",
        mimeType: mime,
        sizeBytes: bytes.length,
        wpMediaId: m.ID,
      });

      await api.writeBinaryFile(slug, `images/harvested/${fname}`, bytes, mime);
    }

    log.push(`Downloaded ${images.length} image(s) from the media library`);
    return { images };
  } finally {
    conn.end();
  }
}

/* ---------------------------------------------------------- external path -- */

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

function normalize(base: string, href: string): string | null {
  try {
    const u = new URL(href, base);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Crawl same-host pages collecting <img> sources + alt text, deduped by URL. */
async function scrapeImageTags(startUrl: string, log: string[]): Promise<Map<string, { alt: string; title: string }>> {
  const seenPages = new Set<string>();
  const queue: string[] = [startUrl];
  const found = new Map<string, { alt: string; title: string }>();

  while (queue.length && seenPages.size < MAX_SCRAPE_PAGES) {
    const url = queue.shift()!;
    if (seenPages.has(url)) continue;
    seenPages.add(url);

    let html: string;
    try {
      const res = await fetch(url, { headers: { "user-agent": "LLS-BuildBot/1.0" }, redirect: "follow" });
      if (!res.ok) continue;
      if (!(res.headers.get("content-type") ?? "").includes("text/html")) continue;
      html = await res.text();
    } catch {
      continue;
    }

    const $ = cheerio.load(html);
    $("img").each((_i, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (!src || src.startsWith("data:")) return;
      const abs = normalize(url, src);
      if (!abs) return;
      if (!found.has(abs)) found.set(abs, { alt: $(el).attr("alt") ?? "", title: $(el).attr("title") ?? "" });
    });

    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const abs = normalize(url, href);
      if (abs && sameHost(abs, startUrl) && !seenPages.has(abs) && queue.length + seenPages.size < MAX_SCRAPE_PAGES) {
        queue.push(abs);
      }
    });
  }

  log.push(`Scraped ${seenPages.size} page(s); found ${found.size} unique <img> source(s)`);
  return found;
}

async function harvestExternal(
  startUrl: string,
  slug: string,
  log: string[]
): Promise<{ images: HarvestImage[] }> {
  const tags = await scrapeImageTags(startUrl, log);
  const images: HarvestImage[] = [];
  const usedNames = new Set<string>();

  for (const [imgUrl, meta] of tags) {
    if (images.length >= MAX_IMAGES) {
      log.push(`Reached MAX_IMAGES (${MAX_IMAGES}); skipping remaining source(s)`);
      break;
    }
    const lower = imgUrl.toLowerCase();
    // Skip vector/icon formats outright; raster size is checked after download.
    if (/\.(svg|ico)(\?|$)/.test(lower) || /sprite|favicon|icon/.test(lower)) continue;

    let bytes: Buffer;
    let mime: string;
    try {
      const res = await fetch(imgUrl, { headers: { "user-agent": "LLS-BuildBot/1.0" }, redirect: "follow" });
      if (!res.ok) {
        log.push(`Skip ${imgUrl}: HTTP ${res.status}`);
        continue;
      }
      mime = ((res.headers.get("content-type") ?? "").split(";")[0] ?? "").trim() || "image/jpeg";
      if (!mime.startsWith("image/")) continue;
      bytes = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      log.push(`Skip ${imgUrl}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (bytes.length < MIN_EXTERNAL_BYTES) continue; // tiny: icon/spacer
    if (bytes.length > MAX_IMAGE_BYTES) {
      log.push(`Skip ${imgUrl}: ${(bytes.length / 1024 / 1024).toFixed(1)}MB exceeds cap`);
      continue;
    }

    let fname = safeName(basename(new URL(imgUrl).pathname), `image-${images.length}`);
    if (!/\.[a-z0-9]+$/i.test(fname)) fname += extForMime(mime);
    if (usedNames.has(fname)) fname = `${images.length}-${fname}`;
    usedNames.add(fname);

    images.push({
      filename: fname,
      storedPath: `images/harvested/${fname}`,
      originalUrl: imgUrl,
      altText: meta.alt,
      title: meta.title,
      mimeType: mime,
      sizeBytes: bytes.length,
    });

    await api.writeBinaryFile(slug, `images/harvested/${fname}`, bytes, mime);
  }

  log.push(`Downloaded ${images.length} image(s) above ${MIN_EXTERNAL_BYTES / 1024}KB`);
  return { images };
}

/* --------------------------------------------------------- categorization -- */

/** Classify images in batches with Claude. Mutates each image's `category`. */
async function categorize(images: HarvestImage[], businessName: string, log: string[]): Promise<void> {
  const BATCH = 50;
  for (let i = 0; i < images.length; i += BATCH) {
    const batch = images.slice(i, i + BATCH);
    const descriptors = batch.map((img, idx) => ({
      ref: String(idx),
      filename: img.filename,
      alt: img.altText.slice(0, 200),
      title: img.title.slice(0, 200),
      mime: img.mimeType,
      size_kb: Math.round(img.sizeBytes / 1024),
    }));

    const prompt = `You are categorizing images harvested from the existing website of "${businessName}", a local service business.

For each image below you are given a thumbnail descriptor: its filename, alt text, title, mime type, and size. Classify each into exactly ONE category:
- hero: large banner / header / lifestyle hero images
- team: people, staff, owner, headshots, crew
- office: building exterior/interior, storefront, shop, equipment, vehicles
- service: work in progress, before/after, the service being performed, projects
- location: maps, city/neighborhood landmarks, service-area imagery
- logo: brand logos, wordmarks, badges, certifications, icons
- other: anything that does not clearly fit the above

Images (JSON):
${JSON.stringify(descriptors, null, 2)}

Return ONLY a JSON array, one object per image, matching by "ref":
[{"ref":"0","category":"hero"}, ...]
Use only these category values: ${CATEGORIES.join(", ")}. No commentary, no code fences.`;

    let parsed: Array<{ ref: string; category: string }> = [];
    try {
      parsed = parseJsonOutput<Array<{ ref: string; category: string }>>(await callClaude(prompt, { maxTokens: 4000 }));
    } catch (err) {
      log.push(`Categorization batch ${i / BATCH} failed, defaulting to "other": ${err instanceof Error ? err.message : String(err)}`);
    }

    const byRef = new Map(parsed.map((p) => [String(p.ref), p.category]));
    batch.forEach((img, idx) => {
      const raw = (byRef.get(String(idx)) ?? "other").toLowerCase();
      img.category = (CATEGORIES as readonly string[]).includes(raw) ? (raw as Category) : "other";
    });
  }
}

/* -------------------------------------------------------------- handler ---- */

export const imageHarvest: JobHandler = async (payload): Promise<HandlerResult> => {
  const log: string[] = [];
  const client = await getClientRow(payload.clientId);
  if (!client) {
    return { outputFiles: [], log: ["Client not found"], status: "failed", errorMessage: `No client row for id ${payload.clientId}` };
  }

  const slug = payload.clientSlug;
  let images: HarvestImage[];

  if (client.managedHosting) {
    log.push("Managed hosting: harvesting via SSH + WP-CLI media library");
    const res = await harvestManaged(client, slug, log);
    if (res.needsReview) {
      return { outputFiles: [], log, status: "needs_review", errorMessage: res.needsReview };
    }
    images = res.images;
  } else {
    const startUrl = client.siteUrl ?? "";
    if (!startUrl) {
      return { outputFiles: [], log: ["No site URL on the client record"], status: "needs_review", errorMessage: "image_harvest (external) needs a site_url to scrape" };
    }
    log.push(`External hosting: scraping images from ${startUrl}`);
    const res = await harvestExternal(startUrl, slug, log);
    images = res.images;
  }

  if (!images.length) {
    // No imagery is a legitimate outcome (empty media library / image-light site),
    // but a human should confirm before the intake checklist advances.
    log.push("No images harvested");
    await api.writeFile(
      slug,
      "images/harvest-manifest.json",
      JSON.stringify({ client: slug, source: client.managedHosting ? "managed_wp_media" : "external_scrape", image_count: 0, images: [] }, null, 2),
      "application/json"
    );
    return {
      outputFiles: ["images/harvest-manifest.json"],
      log,
      status: "needs_review",
      errorMessage: "image_harvest found no images to harvest; confirm the source has imagery or harvest manually",
    };
  }

  log.push(`Categorizing ${images.length} image(s) with Claude`);
  await categorize(images, client.businessName, log);

  // Build + write the manifest.
  const manifest = {
    client: slug,
    business_name: client.businessName,
    source: client.managedHosting ? "managed_wp_media" : "external_scrape",
    harvested_from: client.managedHosting ? client.serverHost : client.siteUrl,
    image_count: images.length,
    images: images.map((img) => ({
      filename: img.filename,
      stored_path: `workspace/${slug}/${img.storedPath}`,
      original_url: img.originalUrl,
      category: img.category,
      suggested_zones: ZONE_SUGGESTIONS[img.category ?? "other"],
      alt_text: img.altText,
      title: img.title,
      mime_type: img.mimeType,
      size_bytes: img.sizeBytes,
      ...(img.wpMediaId !== undefined ? { wp_media_id: img.wpMediaId } : {}),
    })),
  };
  await api.writeFile(slug, "images/harvest-manifest.json", JSON.stringify(manifest, null, 2), "application/json");
  log.push("Wrote images/harvest-manifest.json");

  // Register a photos row per image (source=client, existing imagery tier).
  let registered = 0;
  for (const img of images) {
    try {
      await api.registerPhoto(slug, {
        filename: img.filename,
        source: "client",
        zoneType: img.category,
        altText: img.altText || undefined,
        generationMetadata: {
          harvested: true,
          category: img.category,
          original_url: img.originalUrl,
          stored_path: `workspace/${slug}/${img.storedPath}`,
          mime_type: img.mimeType,
          size_bytes: img.sizeBytes,
          ...(img.wpMediaId !== undefined ? { wp_media_id: img.wpMediaId } : {}),
        },
      });
      registered++;
    } catch (err) {
      log.push(`Photo record for ${img.filename} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  log.push(`Registered ${registered}/${images.length} photo record(s)`);

  await api.completeChecklistItem(slug, "Image harvest complete").catch(() => undefined);

  const counts = images.reduce<Record<string, number>>((acc, img) => {
    const c = img.category ?? "other";
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});
  log.push(`Categories: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ")}`);

  return {
    outputFiles: ["images/harvest-manifest.json", ...images.map((img) => img.storedPath)],
    log,
    status: "completed",
  };
};
