import { Link } from "react-router-dom";
import type { Client } from "../lib/api";

export function KanbanCard({ client }: { client: Client }) {
  return (
    <Link
      to={`/clients/${client.slug}`}
      className="block rounded-lg bg-white border border-sand shadow-sm p-3 hover:border-rust transition-colors"
    >
      <div className="font-semibold text-navy text-sm">{client.businessName}</div>
      <div className="text-xs text-slate mt-1">{client.slug}</div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] uppercase tracking-wide text-slate/70">{client.siteType.replace(/_/g, " ")}</span>
        <span className="text-[10px] rounded bg-sky/40 text-navy px-1.5 py-0.5">Phase {client.phaseUnlocked}</span>
      </div>
      {client.rankMapVerdict && (
        <div className="mt-2 text-[10px] text-rust">Rank map: {client.rankMapVerdict}</div>
      )}
    </Link>
  );
}
