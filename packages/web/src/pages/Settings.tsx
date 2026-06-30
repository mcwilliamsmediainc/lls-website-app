import { useEffect, useState } from "react";
import {
  api,
  type TeamMember,
  type TeamMemberWithPassword,
  type PasswordResetResult,
  TEAM_ROLES,
} from "../lib/api";
import { useAuth } from "../lib/auth";

/**
 * Settings is gated to access_settings. It has two tabs: General (account + Phase
 * 3 placeholders) and Team (the roster). The Team table is readable by any role
 * that can reach Settings; Add / Edit / Reset controls are shown only to matt and
 * tyler — the same admins the edit_team_members permission grants on the API.
 */
export function Settings() {
  const { can, user } = useAuth();
  const [tab, setTab] = useState<"general" | "team">("general");

  if (!can("access_settings")) {
    return <div className="p-6 text-rust">You do not have access to Settings.</div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-extrabold text-navy mb-4">Settings</h1>

      <div className="flex gap-2 border-b border-sand mb-4">
        {(["general", "team"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize -mb-px border-b-2 ${
              tab === t ? "border-navy text-navy" : "border-transparent text-slate/70 hover:text-navy"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <>
          <Section title="Account">
            <p className="text-sm text-slate">
              Signed in as <strong>{user?.name}</strong> ({user?.role}).
            </p>
          </Section>

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
        </>
      )}

      {tab === "team" && (
        <Section title="Team">
          <TeamAdmin isAdmin={user?.role === "matt" || user?.role === "tyler"} />
        </Section>
      )}
    </div>
  );
}

interface FormState {
  id: number | null;
  name: string;
  username: string;
  email: string;
  role: string;
}

const BLANK_FORM: FormState = { id: null, name: "", username: "", email: "", role: "elise" };

function TeamAdmin({ isAdmin }: { isAdmin: boolean }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pw, setPw] = useState<PasswordResetResult | null>(null);

  function load() {
    api.get<TeamMember[]>("/api/team").then(setMembers).catch(() => undefined);
  }
  useEffect(load, []);

  async function toggleActive(m: TeamMember) {
    setBusy(m.id);
    try {
      await api.patch(`/api/team/${m.id}`, { active: !m.active });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update member");
    } finally {
      setBusy(null);
    }
  }

  async function submitForm() {
    if (!form) return;
    setFormError(null);
    setSaving(true);
    try {
      if (form.id === null) {
        const created = await api.post<TeamMemberWithPassword>("/api/team", {
          name: form.name,
          username: form.username,
          email: form.email,
          role: form.role,
        });
        setForm(null);
        setPw({ username: created.username, tempPassword: created.tempPassword });
      } else {
        await api.patch(`/api/team/${form.id}`, {
          name: form.name,
          email: form.email,
          role: form.role,
        });
        setForm(null);
      }
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save team member");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(m: TeamMember) {
    if (!confirm(`Generate a new temporary password for ${m.username}?`)) return;
    setBusy(m.id);
    try {
      const result = await api.post<PasswordResetResult>(`/api/team/${m.id}/reset-password`);
      setPw(result);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to reset password");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {isAdmin && (
        <div className="mb-3">
          <button
            onClick={() => {
              setFormError(null);
              setForm({ ...BLANK_FORM });
            }}
            className="rounded bg-navy text-white px-3 py-1.5 text-sm font-semibold hover:bg-navy/90"
          >
            Add Team Member
          </button>
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-sm text-slate/60">No team members loaded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate/70 border-b border-sand">
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Username</th>
                <th className="py-2 pr-3 font-semibold">Role</th>
                <th className="py-2 pr-3 font-semibold">Active</th>
                {isAdmin && <th className="py-2 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-sand/60">
                  <td className="py-2 pr-3 text-navy">{m.name}</td>
                  <td className="py-2 pr-3 text-slate">{m.username}</td>
                  <td className="py-2 pr-3 text-slate">{m.role}</td>
                  <td className="py-2 pr-3">
                    {isAdmin ? (
                      <button
                        onClick={() => toggleActive(m)}
                        disabled={busy === m.id}
                        className={`rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                          m.active
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-slate/10 text-slate hover:bg-slate/20"
                        }`}
                        title="Toggle active status"
                      >
                        {m.active ? "Active" : "Inactive"}
                      </button>
                    ) : (
                      <span className={m.active ? "text-green-700" : "text-slate/50"}>
                        {m.active ? "Active" : "Inactive"}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-2 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setFormError(null);
                          setForm({
                            id: m.id,
                            name: m.name,
                            username: m.username,
                            email: m.email,
                            role: m.role,
                          });
                        }}
                        disabled={busy === m.id}
                        className="rounded border border-navy text-navy px-2 py-1 text-xs font-medium hover:bg-navy hover:text-white disabled:opacity-50 mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => resetPassword(m)}
                        disabled={busy === m.id}
                        className="rounded border border-rust text-rust px-2 py-1 text-xs font-medium hover:bg-rust hover:text-white disabled:opacity-50"
                      >
                        Reset Password
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title={form.id === null ? "Add Team Member" : `Edit ${form.username}`} onClose={() => setForm(null)}>
          <div className="space-y-3">
            <Field label="Name">
              <input
                className="w-full rounded border border-sand px-2 py-1 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Username">
              <input
                className="w-full rounded border border-sand px-2 py-1 text-sm disabled:bg-sand/40 disabled:text-slate/60"
                value={form.username}
                disabled={form.id !== null}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className="w-full rounded border border-sand px-2 py-1 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                className="w-full rounded border border-sand bg-white px-2 py-1 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>

            {formError && <p className="text-sm text-rust">{formError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setForm(null)}
                className="rounded border border-sand px-3 py-1.5 text-sm text-slate hover:bg-sand/40"
              >
                Cancel
              </button>
              <button
                onClick={submitForm}
                disabled={saving}
                className="rounded bg-navy text-white px-3 py-1.5 text-sm font-semibold hover:bg-navy/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : form.id === null ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pw && (
        <Modal title="Temporary password" onClose={() => setPw(null)}>
          <p className="text-sm text-slate mb-2">
            Temporary password for <strong>{pw.username}</strong>. Copy this now, it won't be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-sand/50 px-3 py-2 font-mono text-sm text-navy break-all">
              {pw.tempPassword}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(pw.tempPassword)}
              className="rounded border border-navy text-navy px-3 py-2 text-sm font-medium hover:bg-navy hover:text-white"
            >
              Copy
            </button>
          </div>
          <div className="flex justify-end pt-3">
            <button
              onClick={() => setPw(null)}
              className="rounded bg-navy text-white px-3 py-1.5 text-sm font-semibold hover:bg-navy/90"
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate/70 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy mb-3">{title}</h3>
        {children}
      </div>
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
