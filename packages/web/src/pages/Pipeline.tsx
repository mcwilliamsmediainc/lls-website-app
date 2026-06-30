import { useEffect, useState } from "react";
import { api, type Client, type Stage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { KanbanCard } from "../components/KanbanCard";

const STAGES: { key: Stage; label: string }[] = [
  { key: "intake", label: "Intake" },
  { key: "mockup", label: "Mockup" },
  { key: "content", label: "Content" },
  { key: "review", label: "Review" },
  { key: "live", label: "Live" },
];

export function Pipeline() {
  const { can } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get<Client[]>("/api/clients").then(setClients).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-extrabold text-navy">Pipeline</h1>
        {can("add_edit_client") && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded bg-rust px-4 py-2 text-white text-sm font-semibold hover:bg-rust/90"
          >
            Add client
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-slate">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {STAGES.map((s) => {
            const cards = clients.filter((c) => c.stage === s.key);
            return (
              <div key={s.key} className="rounded-lg bg-white/60 border border-sand p-3 min-h-[60vh]">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-navy text-sm uppercase tracking-wide">{s.label}</h2>
                  <span className="text-xs text-slate/60">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((c) => (
                    <KanbanCard key={c.id} client={c} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  );
}

function AddClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [siteType, setSiteType] = useState("home_services");
  const [serviceAreas, setServiceAreas] = useState("");
  const [primaryServices, setPrimaryServices] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/clients", {
        businessName,
        slug: slug || businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        siteUrl: siteUrl || undefined,
        siteType,
        serviceAreas: serviceAreas.split(",").map((s) => s.trim()).filter(Boolean),
        primaryServices: primaryServices.split(",").map((s) => s.trim()).filter(Boolean),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-navy/50 flex items-center justify-center p-4 z-10">
      <form onSubmit={submit} className="w-full max-w-lg bg-offwhite rounded-xl p-6 shadow-xl">
        <h2 className="text-lg font-extrabold text-navy mb-4">Add client</h2>
        <div className="space-y-3">
          <Field label="Business name" value={businessName} onChange={setBusinessName} required />
          <Field label="Slug (kebab-case, optional)" value={slug} onChange={setSlug} placeholder="auto from name" />
          <Field label="Existing site URL" value={siteUrl} onChange={setSiteUrl} placeholder="https://…" />
          <div>
            <label className="block text-sm font-medium text-slate mb-1">Vertical</label>
            <select
              value={siteType}
              onChange={(e) => setSiteType(e.target.value)}
              className="w-full rounded border border-sand p-2.5"
            >
              <option value="home_services">Home Services</option>
              <option value="dental_health">Dental / Health</option>
              <option value="legal">Legal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Field label="Service area cities (comma separated)" value={serviceAreas} onChange={setServiceAreas} />
          <Field label="Primary services (comma separated)" value={primaryServices} onChange={setPrimaryServices} />
        </div>
        {error && <div className="text-sm text-rust mt-3">{error}</div>}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate hover:bg-sand/40">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="rounded bg-rust px-4 py-2 text-white text-sm font-semibold disabled:opacity-60">
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate mb-1">{label}</label>
      <input
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-sand p-2.5 focus:border-rust focus:outline-none"
      />
    </div>
  );
}
