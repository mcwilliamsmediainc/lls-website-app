import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export function Login() {
  const { login, completeMfaLogin, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  // Set when the server issues a two-step partial token (MFA_REQUIRED enrolled user).
  const [partialToken, setPartialToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate("/");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (partialToken) {
        // Second step of the two-step MFA login.
        await completeMfaLogin(partialToken, token);
        navigate("/");
        return;
      }
      const result = await login(username, password, token || undefined);
      if (result.mfaRequired) {
        setPartialToken(result.partialToken ?? null);
        setNeedsMfa(true);
        setError("Enter your authenticator code to continue.");
        return;
      }
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError && /mfa/i.test(err.message)) {
        // MFA-off enrolled user: code is supplied inline on the same call.
        setNeedsMfa(true);
        setError("Enter your authenticator code to continue.");
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-navy p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-offwhite rounded-xl p-8 shadow-lg">
        <div className="text-2xl font-extrabold text-navy">LLS Workspace</div>
        <div className="text-sm text-slate mb-6">Sign in to the build pipeline</div>

        <label className="block text-sm font-medium text-slate mb-1">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="w-full rounded border border-sand p-2.5 mb-4 focus:border-rust focus:outline-none"
        />

        <label className="block text-sm font-medium text-slate mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded border border-sand p-2.5 mb-4 focus:border-rust focus:outline-none"
        />

        {needsMfa && (
          <>
            <label className="block text-sm font-medium text-slate mb-1">Authenticator code</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              inputMode="numeric"
              className="w-full rounded border border-sand p-2.5 mb-4 focus:border-rust focus:outline-none"
            />
          </>
        )}

        {error && <div className="text-sm text-rust mb-4">{error}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-rust py-2.5 text-white font-semibold hover:bg-rust/90 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
