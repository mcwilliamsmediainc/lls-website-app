import { useEffect, useState } from "react";
import { api, type TeamMember, TEAM_ROLES } from "../lib/api";
import { useAuth } from "../lib/auth";

/**
 * Settings is gated to access_settings (matt, tyler). The Team section (gated to
 * edit_team_members) lets an admin view the seeded roster, change roles, and
 * reset passwords. KB / worker / image sections remain Phase 3 placeholders.
 */
export function Settings() {
  const { can, user } = useAuth();

  if (!can("access_settings")) {
    return <div className="p-6 text-rust">You do not have access to Settings.</div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-extrabold text-navy mb-4">Settings</h1>

      <Section title="Account">
        <p className="text-sm text-slate">
          Signed in as <strong>{user?.name}</strong> ({user?.role}).
        </p>
      </Section>

      {can("edit_team_members") && (
        <Section title="Team">
          <TeamAdmin />
        </Section>
      )}

      <Section title="Knowledge Base">
        <p className="text-sm text-slate">
          KB documents are managed in the Google Drive folder and cached by the worker every 60 minutes.
          Document-level status and a force-refresh control are surfaced here in Phase 3.
        </p>
      </Section>

      <Section title="Worker metrics">
        <p className="text-sm text-slate">
          Live queue depth and job throughput (Bull Board) embed here in Phase 3. Current worker
          health is visible on the Task Queue page.
        </p>
      </Section>

      <Section title="Image generation">
        <p className="text-sm text-slate">
          Global default provider and per-client overrides are configured here once AI image
          generation is enabled (Phase 3).
        </p>
      </Section>
    </div>
  );
}

function TeamAdmin() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  function load() {
    api.get<TeamMember[]>("/api/team").then(setMembers).catch(() => undefined);
  }
  useEffect(load, []);

  async function changeRole(m: TeamMember, role: string) {
    if (role === m.role) return;
    setBusy(m.id);
    try {
      await api.patch(`/api/team/${m.id}/role`, { role });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword(m: TeamMember) {
    const pw = prompt(`Set a new password for ${m.username} (minimum 8 characters):`);
    if (pw === null) return;
    if (pw.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    setBusy(m.id);
    try {
      await api.post(`/api/team/${m.id}/reset-password`, { password: pw });
      alert(`Password reset for ${m.username}.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to reset password");
    } finally {
      setBusy(null);
    }
  }

  if (members.length === 0) return <p className="text-sm text-slate/60">No team members loaded.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate/70 border-b border-sand">
            <th className="py-2 pr-3 font-semibold">Name</th>
            <th className="py-2 pr-3 font-semibold">Username</th>
            <th className="py-2 pr-3 font-semibold">Role</th>
            <th className="py-2 pr-3 font-semibold">MFA</th>
            <th className="py-2 font-semibold">Password</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b border-sand/60">
              <td className="py-2 pr-3 text-navy">{m.name}</td>
              <td className="py-2 pr-3 text-slate">{m.username}</td>
              <td className="py-2 pr-3">
                <select
                  value={m.role}
                  disabled={busy === m.id}
                  onChange={(e) => changeRole(m, e.target.value)}
                  className="rounded border border-sand bg-white px-2 py-1 text-xs text-navy disabled:opacity-50"
                >
                  {TEAM_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 pr-3">
                <span className={m.hasTotp ? "text-green-700" : "text-slate/50"}>
                  {m.hasTotp ? "enrolled" : "none"}
                </span>
              </td>
              <td className="py-2">
                <button
                  onClick={() => resetPassword(m)}
                  disabled={busy === m.id}
                  className="rounded border border-rust text-rust px-2 py-1 text-xs font-medium hover:bg-rust hover:text-white disabled:opacity-50"
                >
                  Reset password
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-sand bg-white p-4 mb-4">
      <h2 className="font-bold text-navy mb-2">{title}</h2>
      {children}
    </div>
  );
}
