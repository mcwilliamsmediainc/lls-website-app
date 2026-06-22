import { useEffect, useState } from "react";
import { api, type Client } from "../lib/api";

interface Photo {
  id: number;
  filename: string;
  source: string;
  zoneType: string | null;
  pageAssigned: string | null;
  altText: string | null;
  licenseId: string | null;
  optimized: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  client: "Client photo",
  gbp: "GBP photo",
  ai_generated: "AI generated",
  licensed_stock: "Licensed stock",
};

export function PhotoManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [slug, setSlug] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    api.get<Client[]>("/api/clients").then((cs) => {
      setClients(cs);
      if (cs[0]) setSlug(cs[0].slug);
    });
  }, []);

  useEffect(() => {
    if (!slug) return;
    api.get<Photo[]>(`/api/clients/${slug}/photos`).then(setPhotos).catch(() => setPhotos([]));
  }, [slug]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-navy">Photo Manager</h1>
        <select value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded border border-sand p-2 text-sm">
          {clients.map((c) => (
            <option key={c.id} value={c.slug}>{c.businessName}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-slate/70 mb-4">
        Image hierarchy (L40-22): client photos first, then GBP, then AI generation, then licensed stock.
        Proof zones are real photos only.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {photos.map((p) => (
          <div key={p.id} className="rounded-lg border border-sand bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium text-navy text-sm truncate">{p.filename}</div>
              <span className="text-[10px] rounded bg-sky/40 text-navy px-1.5 py-0.5">{SOURCE_LABELS[p.source] ?? p.source}</span>
            </div>
            <div className="text-xs text-slate mt-1">Zone: {p.zoneType ?? "—"}</div>
            <div className="text-xs text-slate">Page: {p.pageAssigned ?? "unassigned"}</div>
            {p.altText && <div className="text-[11px] text-slate/70 mt-1">alt: {p.altText}</div>}
            {p.licenseId && <div className="text-[11px] text-slate/70">license: {p.licenseId}</div>}
          </div>
        ))}
        {photos.length === 0 && <p className="text-sm text-slate/60">No photos registered for this client.</p>}
      </div>
    </div>
  );
}
