import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { AuthProvider, useAuth } from "./lib/auth";
import { App } from "./App";
import { Login } from "./pages/Login";
import { Pipeline } from "./pages/Pipeline";
import { ClientWorkspace } from "./pages/ClientWorkspace";
import { TaskQueue } from "./pages/TaskQueue";
import { ContentLibrary } from "./pages/ContentLibrary";
import { PhotoManager } from "./pages/PhotoManager";
import { Settings } from "./pages/Settings";
import { Onboarding } from "./pages/Onboarding";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-slate">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Brain Injection form */}
        <Route path="/onboarding/:token" element={<Onboarding />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <App />
            </RequireAuth>
          }
        >
          <Route index element={<Pipeline />} />
          <Route path="clients/:slug" element={<ClientWorkspace />} />
          <Route path="tasks" element={<TaskQueue />} />
          <Route path="content" element={<ContentLibrary />} />
          <Route path="photos" element={<PhotoManager />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>
);
