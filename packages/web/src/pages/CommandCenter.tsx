import { useEffect, useRef, useState } from "react";
import { api, type Command } from "../lib/api";
import { useAuth } from "../lib/auth";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate/20 text-slate",
  running: "bg-amber-200 text-amber-900",
  completed: "bg-green-200 text-green-900",
  failed: "bg-red-200 text-red-900",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${STATUS_COLORS[status] ?? "bg-slate/20"}`}>
      {status}
    </span>
  );
}

export function CommandCenter() {
  const { user, can } = useAuth();
  const allowed = can("queue_command");

  const [commands, setCommands] = useState<Command[]>([]);
  const [instruction, setInstruction] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  function load() {
    api.get<Command[]>("/api/commands").then(setCommands).catch(() => undefined);
  }

  useEffect(() => {
    if (!allowed) return;
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-navy mb-2">Command Center</h1>
        <p className="text-sm text-slate">This page is restricted to matt and tyler.</p>
      </div>
    );
  }

  async function send() {
    const text = instruction.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.post("/api/commands", {
        instruction: text,
        queued_by: user?.name ?? user?.username ?? "unknown",
      });
      setInstruction("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  // API returns newest-first; show oldest at top for a chat-style feed.
  const ordered = [...commands].reverse();

  return (
    <div className="flex flex-col h-full p-6">
      <h1 className="text-2xl font-extrabold text-navy mb-1">Command Center</h1>
      <p className="text-xs text-slate/70 mb-4">
        Instructions are queued for the server operator (Claude Code) to run with judgment. Nothing executes
        automatically on the server.
      </p>

      <div ref={logRef} className="flex-1 overflow-auto rounded-lg border border-sand bg-offwhite p-3 space-y-3">
        {ordered.length === 0 && <p className="text-sm text-slate/60">No commands yet.</p>}
        {ordered.map((c) => (
          <div key={c.id} className="rounded border border-sand bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-navy">{c.instruction}</div>
              <StatusBadge status={c.status} />
            </div>
            <div className="text-[11px] text-slate/70 mt-1">
              queued by {c.queuedBy} · {new Date(c.createdAt).toLocaleString()}
            </div>
            {c.output && (
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate bg-offwhite rounded p-2">
                {c.output}
              </pre>
            )}
          </div>
        ))}
      </div>

      {error && <div className="text-xs text-red-700 mt-2">{error}</div>}

      <div className="mt-3 flex gap-2">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Type an instruction for the server…"
          className="flex-1 rounded border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky"
        />
        <button
          onClick={() => void send()}
          disabled={sending || !instruction.trim()}
          className="rounded bg-rust px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
