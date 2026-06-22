import { useEffect, useState } from "react";
import { api, type Client, type ContentPage } from "../lib/api";
import { useAuth } from "../lib/auth";

export function ContentLibrary() {
  const { can } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [slug, setSlug] = useState<string>("");
  const [pages, setPages] = useState<ContentPage[]>([]);

  useEffect(() => {
    api.get<Client[]>("/api/clients").then((cs) => {
      setClients(cs);
      if (cs[0]) setSlug(cs[0].slug);
    });
  }, []);

  function loadPages(s: string) {
    if (!s) return;
    api.get<ContentPage[]>(`/api/clients/${s}/content`).then(setPages).catch(() => setPages([]));
  }
  useEffect(() => loadPages(slug), [slug]);

  async function approve(id: number) {
    try {
      await api.post(`/api/content/${id}/approve`);
      loadPages(slug);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approve failed");
    }
  }

  async function retry(id: number) {
    try {
      await api.post(`/api/content/${id}/retry`);
      loadPages(slug);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Retry failed");
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-navy">Content Library</h1>
        <select value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded border border-sand p-2 text-sm">
          {clients.map((c) => (
            <option key={c.id} value={c.slug}>{c.businessName}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-sand bg-white">
        <table className="w-full text-sm">
          <thead className="bg-offwhite text-navy">
            <tr>
              <th className="text-left p-3">Page</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Words</th>
              <th className="text-left p-3">Gate</th>
              <th className="text-left p-3">[VERIFY]</th>
              <th className="text-left p-3">Schema</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3"></th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => {
              const flagsResolved = p.verifyFlagsResolved >= p.verifyFlagsCount;
              const canApprove = can("approve_content") && p.gateStatus === "passing" && flagsResolved && p.status !== "approved";
              const canRetry = can("queue_job") && (p.gateStatus === "failed" || p.status === "rejected");
              return (
                <tr key={p.id} className="border-t border-sand">
                  <td className="p-3 font-medium text-navy">{p.title ?? p.slug}</td>
                  <td className="p-3">{p.pageType}</td>
                  <td className="p-3">{p.wordCount}</td>
                  <td className="p-3">
                    <span className={p.gateStatus === "passing" ? "text-green-700" : p.gateStatus === "failed" ? "text-rust" : "text-slate/60"}>
                      {p.gateStatus}
                    </span>
                    {p.gateFailureReason && <div className="text-[11px] text-rust">{p.gateFailureReason}</div>}
                  </td>
                  <td className="p-3">{p.verifyFlagsResolved}/{p.verifyFlagsCount}</td>
                  <td className="p-3">{p.schemaGenerated ? "yes" : "no"}</td>
                  <td className="p-3 capitalize">{p.status}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {canApprove && (
                        <button onClick={() => approve(p.id)} className="rounded bg-rust text-white px-3 py-1 text-xs font-semibold">
                          Approve
                        </button>
                      )}
                      {canRetry && (
                        <button onClick={() => retry(p.id)} className="rounded border border-rust text-rust px-3 py-1 text-xs font-semibold hover:bg-rust hover:text-white">
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {pages.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-slate/60">No content pages yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
