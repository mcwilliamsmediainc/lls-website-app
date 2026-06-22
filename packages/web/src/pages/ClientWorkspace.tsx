import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  api,
  type Client,
  type ChecklistItem,
  type Job,
  type BrainInjection,
  type Stage,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { ChecklistItemRow } from "../components/ChecklistItem";
import { JobLog } from "../components/JobLog";

const INTAKE_JOBS = ["site_scrape", "gbp_verify", "geo_research", "gap_report"];
const STAGE_ORDER: Stage[] = ["intake", "content", "review", "live"];

export function ClientWorkspace() {
  const { slug = "" } = useParams();
  const { can } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [brain, setBrain] = useState<BrainInjection | null>(null);
  const [copied, setCopied] = useState(false);

  const loadAll = useCallback(() => {
    api.get<Client>(`/api/clients/${slug}`).then(setClient).catch(() => undefined);
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

  async function pushToLive() {
    if (!confirm("Push this client to live? This runs the two-operation deploy.")) return;
    await api.post(`/api/clients/${slug}/push-to-live`, {});
    loadAll();
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
    </div>
  );
}
