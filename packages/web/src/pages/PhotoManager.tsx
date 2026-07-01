import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type Client, type ContentPage } from "../lib/api";

interface Photo {
  id: number;
  filename: string;
  source: string;
  category: string;
  zoneType: string | null;
  pageAssigned: string | null;
  altText: string | null;
  licenseId: string | null;
  optimized: boolean;
  url: string | null;
}

interface PhotosResponse {
  categories: string[];
  total: number;
  groups: Record<string, Photo[]>;
  photos: Photo[];
}

const CATEGORIES = ["hero", "team", "office", "service", "location", "logo", "other"] as const;
type Category = (typeof CATEGORIES)[number];

const SOURCE_LABELS: Record<string, string> = {
  client: "Client",
  gbp: "GBP",
  ai_generated: "AI",
  licensed_stock: "Stock",
};

const CATEGORY_BADGE: Record<string, string> = {
  hero: "bg-navy text-white",
  team: "bg-sky/60 text-navy",
  office: "bg-emerald-100 text-emerald-800",
  service: "bg-amber-100 text-amber-800",
  location: "bg-violet-100 text-violet-800",
  logo: "bg-slate-200 text-slate-700",
  other: "bg-sand text-slate",
};

/** Page zones surfaced on the right panel, each with the category it prefers when
 * auto-assigning from the harvest classification. */
const ZONES: Array<{ key: string; label: string; category: Category }> = [
  { key: "hero", label: "Hero", category: "hero" },
  { key: "featured", label: "Featured", category: "service" },
  { key: "sidebar", label: "Sidebar", category: "team" },
  { key: "gallery", label: "Gallery", category: "office" },
  { key: "logo", label: "Logo", category: "logo" },
];

function assignmentKey(pageSlug: string, zone: string): string {
  return `${pageSlug}::${zone}`;
}

export function PhotoManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [slug, setSlug] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"all" | Category>("all");
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [pageSlug, setPageSlug] = useState("");
  const [armedZone, setArmedZone] = useState<string | null>(null);

  // Local, unsaved zone -> photoId map (across pages). Seeded from the server state.
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.get<Client[]>("/api/clients").then((cs) => {
      setClients(cs);
      if (cs[0]) setSlug(cs[0].slug);
    });
  }, []);

  function loadPhotos(forSlug: string) {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<PhotosResponse>(`/api/clients/${forSlug}/photos`),
      api.get<ContentPage[]>(`/api/clients/${forSlug}/content`).catch(() => [] as ContentPage[]),
    ])
      .then(([resp, pageRows]) => {
        setPhotos(resp.photos);
        setPages(pageRows);
        if (pageRows[0]) setPageSlug((prev) => prev || pageRows[0].slug);
        // Seed local assignments from what the server already has placed.
        const seeded: Record<string, number> = {};
        for (const p of resp.photos) {
          if (p.pageAssigned && p.zoneType) seeded[assignmentKey(p.pageAssigned, p.zoneType)] = p.id;
        }
        setAssignments(seeded);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load photos"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!slug) return;
    setSelectedImageId(null);
    setArmedZone(null);
    setNotice(null);
    loadPhotos(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const photosById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  const visiblePhotos = useMemo(
    () => (tab === "all" ? photos : photos.filter((p) => p.category === tab)),
    [photos, tab]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of photos) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return counts;
  }, [photos]);

  async function recategorize(photo: Photo, category: string) {
    setNotice(null);
    try {
      await api.patch(`/api/clients/${slug}/photos/${photo.id}`, { category });
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, category } : p)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update category");
    }
  }

  function selectImage(photo: Photo) {
    // If a zone slot is armed, clicking an image assigns it to that slot.
    if (armedZone && pageSlug) {
      setAssignments((prev) => ({ ...prev, [assignmentKey(pageSlug, armedZone)]: photo.id }));
      setArmedZone(null);
      setNotice(`Staged ${photo.filename} in ${armedZone}. Save to apply.`);
    }
    setSelectedImageId(photo.id);
  }

  function assignSelectedToZone(zone: string) {
    // Clicking a zone: if an image is selected, place it; otherwise arm the slot.
    if (selectedImageId && pageSlug) {
      setAssignments((prev) => ({ ...prev, [assignmentKey(pageSlug, zone)]: selectedImageId }));
      setNotice(`Staged image in ${zone}. Save to apply.`);
      setArmedZone(null);
    } else {
      setArmedZone((z) => (z === zone ? null : zone));
    }
  }

  function clearZone(zone: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[assignmentKey(pageSlug, zone)];
      return next;
    });
  }

  function autoAssign() {
    if (!pageSlug) return;
    const used = new Set<number>();
    const next = { ...assignments };
    for (const zone of ZONES) {
      const key = assignmentKey(pageSlug, zone.key);
      if (next[key]) {
        used.add(next[key]);
        continue;
      }
      const match =
        photos.find((p) => p.category === zone.category && !used.has(p.id)) ??
        photos.find((p) => p.category === zone.category);
      if (match) {
        next[key] = match.id;
        used.add(match.id);
      }
    }
    setAssignments(next);
    setNotice("Auto-assigned best matches from the harvest categories. Review, then Save.");
  }

  async function saveAssignments() {
    if (!pageSlug) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      // Only POST slots whose local assignment differs from what the server holds.
      const serverState = new Map<string, number>();
      for (const p of photos) {
        if (p.pageAssigned === pageSlug && p.zoneType) serverState.set(p.zoneType, p.id);
      }
      const changes: Array<{ zone: string; photoId: number }> = [];
      for (const zone of ZONES) {
        const local = assignments[assignmentKey(pageSlug, zone.key)];
        if (local && serverState.get(zone.key) !== local) changes.push({ zone: zone.key, photoId: local });
      }
      if (changes.length === 0) {
        setNotice("No assignment changes to save.");
        setSaving(false);
        return;
      }
      let wpQueued = 0;
      for (const c of changes) {
        const r = await api.post<{ wpSync?: { queued?: boolean } }>(
          `/api/clients/${slug}/photos/${c.photoId}/assign`,
          { page_slug: pageSlug, zone: c.zone }
        );
        if (r.wpSync?.queued) wpQueued++;
      }
      setNotice(
        `Saved ${changes.length} assignment(s).` +
          (wpQueued > 0 ? ` Queued ${wpQueued} staging WordPress update(s).` : "")
      );
      loadPhotos(slug);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save assignments");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-navy">Photo Manager</h1>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="rounded border border-sand p-2 text-sm"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.businessName}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-slate/70 mb-4">
        Image hierarchy (L40-22): client photos first, then GBP, then AI generation, then licensed stock.
        Select an image on the left, then a zone on the right (or arm a zone, then click an image) to place it.
      </p>

      {error && <div className="mb-3 rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      {notice && <div className="mb-3 rounded bg-emerald-50 text-emerald-700 text-sm px-3 py-2">{notice}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* -------- Left: Image Library -------- */}
        <div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => setTab("all")}
              className={`text-xs rounded-full px-3 py-1 border ${
                tab === "all" ? "bg-navy text-white border-navy" : "bg-white text-slate border-sand"
              }`}
            >
              All ({photos.length})
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setTab(c)}
                className={`text-xs rounded-full px-3 py-1 border capitalize ${
                  tab === c ? "bg-navy text-white border-navy" : "bg-white text-slate border-sand"
                }`}
              >
                {c} ({categoryCounts[c] ?? 0})
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-slate/60">Loading photos…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto pr-1">
              {visiblePhotos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectImage(p)}
                  className={`rounded-lg border bg-white p-2 cursor-pointer transition ${
                    selectedImageId === p.id ? "border-navy ring-2 ring-navy/40" : "border-sand hover:border-sky"
                  }`}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-sand/40">
                    {p.url ? (
                      <img src={p.url} alt={p.altText ?? p.filename} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate/50">
                        no preview
                      </div>
                    )}
                    <span
                      className={`absolute top-1 left-1 text-[9px] rounded px-1 py-0.5 capitalize ${
                        CATEGORY_BADGE[p.category] ?? "bg-sand text-slate"
                      }`}
                    >
                      {p.category}
                    </span>
                    <span className="absolute top-1 right-1 text-[9px] rounded bg-white/80 text-slate px-1 py-0.5">
                      {SOURCE_LABELS[p.source] ?? p.source}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] font-medium text-navy" title={p.filename}>
                    {p.filename}
                  </div>
                  <div className="text-[10px] text-slate/70">
                    {p.pageAssigned ? `${p.pageAssigned} · ${p.zoneType ?? "?"}` : "unassigned"}
                  </div>
                  <select
                    value={p.category}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => recategorize(p, e.target.value)}
                    className="mt-1 w-full rounded border border-sand text-[10px] p-0.5 capitalize"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {visiblePhotos.length === 0 && (
                <p className="col-span-full text-sm text-slate/60">No photos in this category.</p>
              )}
            </div>
          )}
        </div>

        {/* -------- Right: Page Zone Map -------- */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-sm text-slate">Page:</label>
            <select
              value={pageSlug}
              onChange={(e) => {
                setPageSlug(e.target.value);
                setArmedZone(null);
              }}
              className="rounded border border-sand p-1.5 text-sm flex-1"
            >
              {pages.length === 0 && <option value="">No content pages</option>}
              {pages.map((pg) => (
                <option key={pg.id} value={pg.slug}>
                  {pg.title ?? pg.slug} ({pg.pageType})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {ZONES.map((zone) => {
              const assignedId = assignments[assignmentKey(pageSlug, zone.key)];
              const assigned = assignedId != null ? photosById.get(assignedId) : undefined;
              const isArmed = armedZone === zone.key;
              return (
                <div
                  key={zone.key}
                  onClick={() => assignSelectedToZone(zone.key)}
                  className={`flex items-center gap-3 rounded-lg border p-2 cursor-pointer ${
                    isArmed ? "border-navy ring-2 ring-navy/40 bg-navy/5" : "border-sand bg-white hover:border-sky"
                  }`}
                >
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-sand/40">
                    {assigned?.url ? (
                      <img src={assigned.url} alt={assigned.filename} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] text-slate/50">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-navy">{zone.label}</div>
                    <div className="truncate text-[11px] text-slate/70">
                      {assigned ? assigned.filename : isArmed ? "Click an image to assign" : "No image assigned"}
                    </div>
                  </div>
                  {assigned && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearZone(zone.key);
                      }}
                      className="text-[11px] text-slate/60 hover:text-red-600"
                    >
                      clear
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={saveAssignments}
              disabled={saving || !pageSlug}
              className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Assignments"}
            </button>
            <button
              onClick={autoAssign}
              disabled={!pageSlug || photos.length === 0}
              className="rounded border border-navy px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
            >
              Auto-assign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
