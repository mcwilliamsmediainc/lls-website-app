import type { Job } from "../lib/api";

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-sand text-navy",
  running: "bg-sky text-navy",
  completed: "bg-green-200 text-green-900",
  failed: "bg-red-200 text-red-900",
  gate_failed: "bg-rust/20 text-rust",
  held: "bg-yellow-200 text-yellow-900",
};

export function JobStatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${STATUS_COLORS[status] ?? "bg-slate/20"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function JobLog({ job }: { job: Job }) {
  return (
    <div className="rounded border border-sand bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-navy text-sm">{job.taskType.replace(/_/g, " ")}</div>
        <JobStatusBadge status={job.status} />
      </div>
      <div className="text-[11px] text-slate/70 mt-1">
        Queued {new Date(job.queuedAt).toLocaleString()}
      </div>
      {job.errorMessage && <div className="text-[11px] text-red-700 mt-1">{job.errorMessage}</div>}
      {job.log && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-slate bg-offwhite rounded p-2">
          {job.log}
        </pre>
      )}
      {job.outputFiles.length > 0 && (
        <div className="mt-2 text-[11px] text-slate">
          Outputs: {job.outputFiles.join(", ")}
        </div>
      )}
    </div>
  );
}
