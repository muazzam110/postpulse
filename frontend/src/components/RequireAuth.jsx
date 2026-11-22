import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (user === undefined) return <div role="status" className="grid min-h-screen place-items-center text-ink-3">Loading…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: pathname }} />;
}
