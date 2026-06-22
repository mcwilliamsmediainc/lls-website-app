import { useEffect, useState } from "react";
import { api, type Job, type WorkerHealth } from "../lib/api";
import { JobLog } from "../components/JobLog";

export function TaskQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<WorkerHealth[]>([]);

  function load() {
    api.get<Job[]>("/api/jobs").then(setJobs).catch(() => undefined);
    api.get<WorkerHealth[]>("/api/system/workers").then(setWorkers).catch(() => undefined);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const anyStale = workers.some((w) => w.stale);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold text-navy mb-4">Task Queue</h1>

      <div className={`rounded-lg border p-3 mb-5 text-sm ${anyStale ? "border-rust bg-rust/10 text-rust" : "border-sand bg-white text-slate"}`}>
        {workers.length === 0 ? (
          "No worker heartbeats recorded yet."
        ) : (
          <div className="flex flex-wrap gap-4">
            {workers.map((w) => (
              <span key={w.workerId}>
                <strong>{w.workerId}</strong>: {w.status} · {w.jobsProcessed} jobs · last seen {w.secondsSinceLastSeen}s ago
                {w.stale && " (STALE)"}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {jobs.map((j) => (
          <JobLog key={j.id} job={j} />
        ))}
        {jobs.length === 0 && <p className="text-sm text-slate/60">No jobs.</p>}
      </div>
    </div>
  );
}
