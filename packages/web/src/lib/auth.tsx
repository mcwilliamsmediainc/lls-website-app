import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type AuthResponse, type Permission, type User } from "./api";

interface AuthState {
  user: User | null;
  permissions: Record<Permission, boolean> | null;
  loading: boolean;
  login: (username: string, password: string, token?: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (p: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Record<Permission, boolean> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AuthResponse>("/api/auth/me")
      .then((r) => {
        setUser(r.user);
        setPermissions(r.permissions);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string, token?: string) {
    const r = await api.post<AuthResponse>("/api/auth/login", { username, password, token });
    setUser(r.user);
    setPermissions(r.permissions);
  }

  async function logout() {
    await api.post("/api/auth/logout");
    setUser(null);
    setPermissions(null);
  }

  function can(p: Permission) {
    return Boolean(permissions?.[p]);
  }

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
