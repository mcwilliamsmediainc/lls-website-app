import { useEffect, useRef, useState } from "react";
import { api, type Command, type HeartbeatResponse } from "../lib/api";
import { useAuth } from "../lib/auth";

/* ---- terminal palette (exact hex per spec) ---- */
const C = {
  bg: "#0d0d0d",
  green: "#22c55e",
  white: "#f4f4f4",
  blue: "#60a5fa",
  amber: "#f59e0b",
  red: "#ef4444",
  dim: "#6b7280",
  divider: "#262626",
  border: "#1f2937",
};
const MONO = "'Courier New', Courier, monospace";
const HOST = "lls-prod-01";

/* ---- formatting helpers ---- */
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** "Mon Jun 22 18:42:11 UTC 2026" — matches `date -u`. */
function fmtTs(iso: string): string {
  const d = new Date(iso);
  return `${WD[d.getUTCDay()]} ${MO[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes()
  )}:${pad(d.getUTCSeconds())} UTC ${d.getUTCFullYear()}`;
}

function elapsedStr(startIso: string, endMs: number): string {
  const s = Math.max(0, Math.round((endMs - new Date(startIso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${pad(s % 60)}s`;
}

/** "Matt McWilliams" -> "matt" for a shell-style prompt. */
function shellUser(name: string | undefined | null): string {
  const u = (name ?? "user").trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return u || "user";
}

type Live = { dot: string; label: string };
function liveFrom(secs: number | null): Live {
  if (secs === null) return { dot: C.red, label: "Claude offline" };
  if (secs <= 120) return { dot: C.green, label: "Claude is live" };
  if (secs <= 300) return { dot: C.amber, label: "Claude idle" };
  return { dot: C.red, label: "Claude offline" };
}

export function CommandCenter() {
  const { user, can } = useAuth();
  const allowed = can("queue_command");

  const [commands, setCommands] = useState<Command[]>([]);
  const [instruction, setInstruction] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  // worker heartbeat: seconds-since-last-seen at the moment we fetched it, plus when.
  const [hb, setHb] = useState<{ secs: number; at: number } | null>(null);
  const [hbFetched, setHbFetched] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const bodyRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  function loadCommands() {
    api.get<Command[]>("/api/commands").then(setCommands).catch(() => undefined);
  }
  function loadHeartbeat() {
    api
      .get<HeartbeatResponse>("/api/system/heartbeat")
      .then((r) => {
        setHbFetched(true);
        setHb(r.heartbeat ? { secs: r.heartbeat.secondsSinceLastSeen, at: Date.now() } : null);
      })
      .catch(() => undefined);
  }

  // Commands: poll every 3s.
  useEffect(() => {
    if (!allowed) return;
    loadCommands();
    const t = setInterval(loadCommands, 3000);
    return () => clearInterval(t);
  }, [allowed]);

  // Heartbeat: poll every 30s.
  useEffect(() => {
    if (!allowed) return;
    loadHeartbeat();
    const t = setInterval(loadHeartbeat, 30000);
    return () => clearInterval(t);
  }, [allowed]);

  // 1s ticker so running timers and the live indicator advance between polls.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll to the bottom on new output, but only if the user is already near it.
  useEffect(() => {
    if (stickRef.current && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [commands, now]);

  function onBodyScroll() {
    const el = bodyRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  if (!allowed) {
    return (
      <div style={{ background: C.bg, color: C.green, fontFamily: MONO }} className="h-full p-6 text-sm">
        <h1 className="sr-only">{HOST} ~ %</h1>
        {HOST}: permission denied — Command Center is restricted to matt and tyler.
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
      stickRef.current = true;
      loadCommands();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function selectBlock(e: React.MouseEvent<HTMLDivElement>) {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(e.currentTarget);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function copyBlock(c: Command, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId((id) => (id === c.id ? null : id)), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  // API returns newest-first; terminal shows oldest at top, newest at bottom.
  const ordered = [...commands].reverse();
  const liveSecs = hb === null ? (hbFetched ? null : null) : hb.secs + Math.round((now - hb.at) / 1000);
  const live = liveFrom(liveSecs);
  const prompt = `${shellUser(user?.name ?? user?.username)}@${HOST}:~$`;

  return (
    <div
      style={{ background: C.bg, color: C.green, fontFamily: MONO }}
      className="flex h-full flex-col text-[13px] leading-relaxed"
    >
      <style>{`@keyframes term-blink { 0%,49% { opacity:1 } 50%,100% { opacity:0 } }`}</style>
      <h1 className="sr-only">{HOST} ~ %</h1>

      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <span style={{ color: C.dim }}>
          <span style={{ color: C.green }}>{HOST}</span> — Claude Code
        </span>
        <span className="flex items-center gap-2" style={{ color: C.dim }} title={`worker last seen ${liveSecs ?? "?"}s ago`}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              background: live.dot,
              boxShadow: `0 0 6px ${live.dot}`,
              display: "inline-block",
            }}
          />
          <span style={{ color: live.dot }}>{live.label}</span>
        </span>
      </div>

      {/* Terminal body */}
      <div ref={bodyRef} onScroll={onBodyScroll} className="flex-1 overflow-auto px-4 py-3">
        {ordered.length === 0 && <div style={{ color: C.dim }}>{HOST}: no commands yet. Type one below.</div>}
        {ordered.map((c) => {
          const user0 = shellUser(c.queuedBy);
          const head = `[${fmtTs(c.createdAt)}] ${user0}@${HOST}:~$  ${c.instruction}`;
          const footer =
            c.status === "completed"
              ? `[completed in ${elapsedStr(c.startedAt ?? c.createdAt, c.completedAt ? new Date(c.completedAt).getTime() : now)}]`
              : c.status === "failed"
              ? `[failed in ${elapsedStr(c.startedAt ?? c.createdAt, c.completedAt ? new Date(c.completedAt).getTime() : now)}]`
              : c.status === "running"
              ? `[running ${elapsedStr(c.startedAt ?? c.createdAt, now)}]`
              : `[queued — waiting for operator]`;
          const blockText = `${head}\n\n${c.output ?? ""}\n\n${footer}`;

          return (
            <div key={c.id} className="group relative mb-1">
              {/* Copy button (hover, top-right) */}
              <button
                onClick={() => void copyBlock(c, blockText)}
                className="absolute right-0 top-0 hidden px-2 py-0.5 text-[11px] group-hover:block"
                style={{ background: "#161616", color: C.dim, border: `1px solid ${C.border}` }}
              >
                {copiedId === c.id ? "Copied" : "Copy"}
              </button>

              {/* Block (click to select all) */}
              <div onClick={selectBlock} className="cursor-text whitespace-pre-wrap break-words">
                <div>
                  <span style={{ color: C.dim }}>[{fmtTs(c.createdAt)}] </span>
                  <span style={{ color: C.green }}>
                    {user0}@{HOST}
                  </span>
                  <span style={{ color: C.dim }}>:~$ </span>
                  <span style={{ color: C.blue }}>{c.instruction}</span>
                </div>

                {c.output && (
                  <div
                    className="mt-1"
                    style={{
                      color: c.status === "failed" ? C.red : C.white,
                      fontWeight: 600,
                      fontSize: "15px",
                    }}
                  >
                    {c.output}
                  </div>
                )}

                <div className="mt-1">
                  {c.status === "running" ? (
                    <span style={{ color: C.amber }}>
                      {footer}{" "}
                      <span style={{ animation: "term-blink 1s step-end infinite", color: C.amber }}>▋</span>
                    </span>
                  ) : (
                    <span
                      style={{
                        color: c.status === "completed" ? C.green : c.status === "failed" ? C.red : C.dim,
                      }}
                    >
                      {footer}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ color: C.divider, overflow: "hidden", whiteSpace: "nowrap" }} className="mt-2 select-none">
                {"─".repeat(220)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div style={{ borderTop: `1px solid ${C.border}` }} className="px-4 py-2">
        {error && <div style={{ color: C.red }} className="mb-1">{error}</div>}
        <div className="flex items-start gap-2">
          <span style={{ color: C.green }} className="shrink-0 pt-1 whitespace-nowrap">
            {prompt}
          </span>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            spellCheck={false}
            autoFocus
            placeholder="type a command…"
            className="flex-1 resize-none bg-transparent outline-none"
            style={{ color: C.blue, fontFamily: MONO, caretColor: C.blue }}
          />
        </div>
        <div style={{ color: C.dim }} className="mt-1 text-[11px]">
          Claude Code is watching. Commands run on {HOST}.{" "}
          {sending && <span style={{ color: C.amber }}>sending…</span>}
        </div>
      </div>
    </div>
  );
}
