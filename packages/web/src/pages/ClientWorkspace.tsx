import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  api,
  type Client,
  type ChecklistItem,
  type Job,
  type BrainInjection,
  type Stage,
  type Permission,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { ChecklistItemRow } from "../components/ChecklistItem";
import { JobLog } from "../components/JobLog";

const INTAKE_JOBS = ["site_scrape", "gbp_verify", "geo_research", "gap_report"];
const STAGE_ORDER: Stage[] = ["intake", "mockup", "content", "review", "live"];

export function ClientWorkspace() {
  const { slug = "" } = useParams();
  const { can } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [brain, setBrain] = useState<BrainInjection | null>(null);
  const [copied, setCopied] = useState(false);
  const [building, setBuilding] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesStatus, setNotesStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [tab, setTab] = useState<"overview" | "mockup">("overview");

  const loadAll = useCallback(() => {
    api
      .get<Client>(`/api/clients/${slug}`)
      .then((c) => {
        setClient(c);
        setNotes(c.notes ?? "");
      })
      .catch(() => undefined);
    api.get<ChecklistItem[]>(`/api/clients/${slug}/checklist`).then(setChecklist).catch(() => undefined);
    api.get<Job[]>(`/api/jobs?clientSlug=${slug}`).then(setJobs).catch(() => undefined);
    api.get<BrainInjection>(`/api/clients/${slug}/brain-injection`).then(setBrain).catch(() => setBrain(null));
  }, [slug]);

  useEffect(loadAll, [loadAll]);

  async function queueJob(taskType: string) {
    await api.post("/api/jobs", { clientSlug: slug, taskType, params: {} });
    loadAll();
  }

  async function moveStage(stage: Stage) {
    await api.post(`/api/clients/${slug}/stage`, { stage });
    loadAll();
  }

  async function saveNotes() {
    if (!client || notes === (client.notes ?? "")) return;
    setNotesStatus("saving");
    try {
      const updated = await api.patch<Client>(`/api/clients/${slug}`, { notes });
      setClient(updated);
      setNotesStatus("saved");
      setTimeout(() => setNotesStatus("idle"), 2000);
    } catch {
      setNotesStatus("idle");
    }
  }

  async function pushToLive() {
    if (!confirm("Push this client to live? This runs the two-operation deploy.")) return;
    await api.post(`/api/clients/${slug}/push-to-live`, {});
    loadAll();
  }

  async function startContentBuild() {
    if (!confirm("Start the content build? This queues page generation for home, about, contact, every service, and every service-area city.")) return;
    setBuilding(true);
    try {
      const r = await api.post<{ pages: number }>(`/api/clients/${slug}/build-content`, {});
      alert(`Queued ${r.pages} page generation job(s).`);
      loadAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to start content build");
    } finally {
      setBuilding(false);
    }
  }

  function copyLink() {
    if (!brain) return;
    navigator.clipboard.writeText(brain.onboardingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!client) return <div className="p-6 text-slate">Loading…</div>;

  const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(client.stage) + 1];
  const stageChecklist = checklist.filter((c) => c.stage === client.stage);
  const intakeItems = checklist.filter((c) => c.stage === "intake");
  const intakeComplete =
    intakeItems.length > 0 && intakeItems.every((c) => c.status === "complete" || c.status === "skipped");
  const canStartContentBuild =
    client.stage === "content" && client.mockupApproved && intakeComplete && can("queue_job");
  const gbpNeedsReview = jobs.some((j) => j.taskType === "gbp_verify" && j.status === "needs_review");

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">{client.businessName}</h1>
          <div className="text-sm text-slate">
            {client.slug} · stage <span className="font-semibold capitalize">{client.stage}</span>
            {client.stagingUrl && <> · <a className="text-rust underline" href={`https://${client.stagingUrl}`} target="_blank" rel="noreferrer">staging</a></>}
          </div>
        </div>
        <div className="flex gap-2">
          {canStartContentBuild && (
            <button onClick={startContentBuild} disabled={building} className="rounded bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50">
              {building ? "Starting…" : "Start Content Build"}
            </button>
          )}
          {nextStage && can("add_edit_client") && (
            <button onClick={() => moveStage(nextStage)} className="rounded border border-rust text-rust px-3 py-2 text-sm font-semibold hover:bg-rust hover:text-white">
              Move to {nextStage}
            </button>
          )}
          {client.stage === "review" && can("push_to_live") && (
            <button onClick={pushToLive} className="rounded bg-rust px-3 py-2 text-sm font-semibold text-white hover:bg-rust/90">
              Push to Live
            </button>
          )}
        </div>
      </header>

      {gbpNeedsReview && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">GBP / NAP unverified.</span> The gbp_verify job could not confirm the
          business name, address, phone, and hours (no available read path or the lookup failed). Confirm the NAP in
          client-facts.md and mark the intake item complete before starting the content build.
        </div>
      )}

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-sand">
        {(["overview", "mockup"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 -mb-px ${
              tab === t ? "border-rust text-rust" : "border-transparent text-slate hover:text-navy"
            }`}
          >
            {t}
            {t === "mockup" && client.mockupApproved && <span className="ml-1 text-emerald-600">✓</span>}
          </button>
        ))}
      </nav>

      {tab === "mockup" && <MockupPanel slug={slug} client={client} onChange={loadAll} can={can} />}

      {tab === "overview" && (
        <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist */}
        <section className="lg:col-span-1 rounded-lg bg-white border border-sand p-4">
          <h2 className="font-bold text-navy mb-2">Checklist · {client.stage}</h2>
          {stageChecklist.length === 0 && <p className="text-sm text-slate/60">No items for this stage yet.</p>}
          {stageChecklist.map((item) => (
            <ChecklistItemRow key={item.id} slug={slug} item={item} onChange={loadAll} />
          ))}
        </section>

        {/* Brain Injection card */}
        <section className="lg:col-span-1 rounded-lg bg-white border border-sand p-4">
          <h2 className="font-bold text-navy mb-2">Brain Injection</h2>
          {!brain ? (
            <p className="text-sm text-slate/60">No record.</p>
          ) : (
            <>
              <div className="text-sm mb-2">
                Status: <span className="font-semibold capitalize">{brain.status}</span>
              </div>
              <button onClick={copyLink} className="rounded bg-sky text-navy px-3 py-1.5 text-sm font-semibold hover:bg-sky/80">
                {copied ? "Copied" : "Copy link"}
              </button>
              {brain.answers && (
                <dl className="mt-3 space-y-2 text-sm">
                  {Object.entries(brain.answers).map(([k, v]) =>
                    v ? (
                      <div key={k}>
                        <dt className="font-semibold text-navy capitalize">{k.replace(/([A-Z])/g, " $1")}</dt>
                        <dd className="text-slate">{v}</dd>
                      </div>
                    ) : null
                  )}
                </dl>
              )}
              {brain.status === "submitted" && can("approve_content") && (
                <button
                  onClick={async () => {
                    await api.post(`/api/clients/${slug}/brain-injection/review`, {});
                    loadAll();
                  }}
                  className="mt-3 rounded border border-rust text-rust px-3 py-1.5 text-sm font-semibold hover:bg-rust hover:text-white"
                >
                  Mark reviewed
                </button>
              )}
            </>
          )}
        </section>

        {/* Queue jobs */}
        <section className="lg:col-span-1 rounded-lg bg-white border border-sand p-4">
          <h2 className="font-bold text-navy mb-2">Queue intake jobs</h2>
          <div className="flex flex-wrap gap-2">
            {INTAKE_JOBS.map((j) => (
              <button
                key={j}
                onClick={() => queueJob(j)}
                className="rounded border border-sand px-3 py-1.5 text-xs font-medium text-navy hover:border-rust"
              >
                {j.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Team notes */}
      <section className="rounded-lg bg-white border border-sand p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-navy">Team notes</h2>
          <span className="text-xs text-slate/60">
            {notesStatus === "saving" ? "Saving..." : notesStatus === "saved" ? "Saved" : "Saved on blur"}
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          disabled={!can("add_edit_client")}
          rows={4}
          placeholder="Intake context, client requests, anything not in client-facts.md."
          className="w-full rounded border border-sand p-2 text-sm text-navy focus:border-rust focus:outline-none disabled:opacity-60"
        />
      </section>

      {/* Activity log */}
      <section>
        <h2 className="font-bold text-navy mb-3">Activity log</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {jobs.map((j) => (
            <JobLog key={j.id} job={j} />
          ))}
          {jobs.length === 0 && <p className="text-sm text-slate/60">No jobs queued yet.</p>}
        </div>
      </section>
        </>
      )}
    </div>
  );
}

function MockupPanel({
  slug,
  client,
  onChange,
  can,
}: {
  slug: string;
  client: Client;
  onChange: () => void;
  can: (p: Permission) => boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filePath = client.mockupFilePath;
  const filename = filePath ? filePath.replace(/^.*\//, "") : null;
  const isImage = !!filename && /\.(png|jpe?g|webp|gif|svg)$/i.test(filename);
  const isHtml = !!filename && /\.html?$/i.test(filename);
  const isPdf = !!filename && /\.pdf$/i.test(filename);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!filePath) return;
    api
      .get<{ url: string }>(`/api/clients/${slug}/files/download?key=${encodeURIComponent(filePath)}`)
      .then((r) => {
        if (active) setUrl(r.url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [slug, filePath]);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] ?? "";
      await api.post(`/api/clients/${slug}/mockup`, {
        filename: file.name,
        content: base64,
        encoding: "base64",
        contentType: file.type || undefined,
      });
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function approve(approved: boolean) {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/clients/${slug}/mockup/approve`, { approved });
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update approval");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg bg-white border border-sand p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-navy">Design mockup</h2>
        <span
          className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
            client.mockupApproved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {client.mockupApproved ? "Approved" : filePath ? "Awaiting approval" : "Not uploaded"}
        </span>
      </div>

      {!filePath && <p className="text-sm text-slate/70">No mockup uploaded yet. Upload an HTML or image mockup to begin the approval gate.</p>}

      {filePath && (
        <div className="rounded border border-sand overflow-hidden bg-offwhite">
          {!url ? (
            <div className="p-6 text-sm text-slate/60">Loading preview…</div>
          ) : isImage ? (
            <img src={url} alt={`${client.businessName} mockup`} className="max-h-[70vh] w-full object-contain" />
          ) : isHtml || isPdf ? (
            <iframe src={url} title="mockup" className="w-full h-[70vh] bg-white" />
          ) : (
            <div className="p-6 text-sm">
              <a href={url} target="_blank" rel="noreferrer" className="text-rust underline">
                Download {filename}
              </a>
            </div>
          )}
        </div>
      )}

      {error && <div className="text-sm text-rust">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        {can("add_edit_client") && (
          <label className="rounded border border-sand px-3 py-2 text-sm font-medium text-navy hover:border-rust cursor-pointer">
            {filePath ? "Replace mockup" : "Upload mockup"}
            <input
              type="file"
              accept=".html,.htm,image/*,application/pdf"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
        )}
        {can("approve_content") &&
          filePath &&
          (client.mockupApproved ? (
            <button
              onClick={() => approve(false)}
              disabled={busy}
              className="rounded border border-rust text-rust px-3 py-2 text-sm font-semibold hover:bg-rust hover:text-white disabled:opacity-50"
            >
              Revoke approval
            </button>
          ) : (
            <button
              onClick={() => approve(true)}
              disabled={busy}
              className="rounded bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Approve mockup"}
            </button>
          ))}
      </div>

      {filePath && !client.mockupApproved && (
        <p className="text-xs text-slate/60">
          The content build is blocked until the mockup is approved. Replacing the mockup clears any prior approval.
        </p>
      )}
    </section>
  );
}
