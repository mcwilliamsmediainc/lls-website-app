import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./lib/auth";

const navItems = [
  { to: "/", label: "Pipeline", end: true },
  { to: "/tasks", label: "Task Queue" },
  { to: "/content", label: "Content Library" },
  { to: "/photos", label: "Photo Manager" },
];

export function App() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 bg-navy text-offwhite flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="text-lg font-extrabold tracking-tight">LLS Workspace</div>
          <div className="text-xs text-sky">Build Pipeline</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-rust text-white" : "text-sky hover:bg-white/10"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {can("access_settings") && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-rust text-white" : "text-sky hover:bg-white/10"
                }`
              }
            >
              Settings
            </NavLink>
          )}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs">
          <div className="font-semibold">{user?.name}</div>
          <div className="text-sky capitalize">{user?.role}</div>
          <button onClick={handleLogout} className="mt-2 text-sky hover:text-white underline">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
