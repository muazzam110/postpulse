import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { EmptyState } from "@/components/brand/EmptyState";
import { Button } from "@/components/ui/button";
import { AuthProvider } from "@/hooks/useAuth";
import { ALL_NAV } from "@/nav";
import { Login, Register } from "@/pages/Auth";
import Editor from "@/pages/Editor";
import Knowledge from "@/pages/Knowledge";
import Calendar from "@/pages/Calendar";
import Library from "@/pages/Library";
import Planner from "@/pages/Planner";
import Settings from "@/pages/Settings";
import Studio from "@/pages/Studio";
import Voice from "@/pages/Voice";

function ComingSoon({ item }) {
  return (
    <>
      <PageHeader title={item.label} />
      <EmptyState icon={item.icon} title="Not open yet" description={item.blurb} />
    </>
  );
}

function NotFound() {
  return (
    <EmptyState title="Page not found" description="That address doesn't lead anywhere.">
      <Button asChild><Link to="/app/studio">Back to Studio</Link></Button>
    </EmptyState>
  );
}

const PAGES = { studio: <Studio />, library: <Library />, knowledge: <Knowledge />, planner: <Planner />, calendar: <Calendar />, voice: <Voice />, settings: <Settings /> };

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/app/studio" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<RequireAuth />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="studio" replace />} />
            {ALL_NAV.map((item) => (
              <Route key={item.to} path={item.to} element={PAGES[item.to] ?? <ComingSoon item={item} />} />
            ))}
            <Route path="studio/:id" element={<Editor />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
