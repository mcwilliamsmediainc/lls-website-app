import { useAuth } from "../lib/auth";

/**
 * Settings is gated to access_settings (matt, tyler). MVP surface: shows the
 * connection status placeholders the spec calls for (KB documents, worker metrics).
 * Live wiring of Bull Board and KB document status is a Phase 3 task.
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-sand bg-white p-4 mb-4">
      <h2 className="font-bold text-navy mb-2">{title}</h2>
      {children}
    </div>
  );
}
