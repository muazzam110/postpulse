import { useEffect, useState } from "react";
import { Ellipsis, LogOut, Moon, Sun } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { KeyStatusPill } from "@/components/brand/KeyStatusPill";
import { TrustNote } from "@/components/brand/TrustNote";
import { whyNoKey } from "@/components/brand/keyMessages";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useOpenRouterKey } from "@/hooks/useOpenRouterKey";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { ALL_NAV, FOOTER_NAV, MOBILE_TABS, NAV } from "@/nav";

const sideClass = ({ isActive }) =>
  cn(
    "relative flex h-10 items-center gap-3 rounded-lg px-3 text-ink-2 transition-colors hover:text-ink md:justify-center lg:justify-start",
    isActive && "bg-surface text-ink before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-ember",
  );

function SideLink({ item }) {
  return (
    <NavLink to={`/app/${item.to}`} className={sideClass}>
      <item.icon strokeWidth={1.5} className="size-[18px] shrink-0" />
      <span className="sr-only lg:not-sr-only">{item.label}</span>
    </NavLink>
  );
}

const tabClass = ({ isActive }) =>
  cn("flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-3", isActive && "text-ink");

function MobileTabs() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const tabs = MOBILE_TABS.map((to) => ALL_NAV.find((n) => n.to === to));
  const more = ALL_NAV.filter((n) => !MOBILE_TABS.includes(n.to));
  return (
    <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-20 border-t bg-surface md:hidden">
      {open && (
        <ul id="more-nav" className="absolute inset-x-3 bottom-[calc(100%+8px)] rounded-card border bg-surface p-1 shadow-pop animate-fade-up">
          {more.map((item) => (
            <li key={item.to}>
              <NavLink to={`/app/${item.to}`} className="flex h-11 items-center gap-3 rounded-lg px-3 text-ink-2 hover:bg-surface-2">
                <item.icon strokeWidth={1.5} className="size-[18px]" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-5">
        {tabs.map((item) => (
          <NavLink key={item.to} to={`/app/${item.to}`} className={tabClass}>
            <item.icon strokeWidth={1.5} className="size-5" />
            {item.label}
          </NavLink>
        ))}
        <button type="button" aria-expanded={open} aria-controls="more-nav" onClick={() => setOpen(!open)} className={tabClass({ isActive: open })}>
          <Ellipsis strokeWidth={1.5} className="size-5" />
          More
        </button>
      </div>
    </nav>
  );
}

/** Tells a signed-in user, wherever they are, that nothing can be written until a key is added. Settings has the form itself. */
function KeyPrompt({ state }) {
  const { pathname } = useLocation();
  if (state.status === "connected" || pathname.startsWith("/app/settings")) return null;
  return (
    <TrustNote tone="amber" className="mb-6">
      {whyNoKey(state)} <Link to="/app/settings" className="whitespace-nowrap font-medium underline underline-offset-4">Add key</Link>
    </TrustNote>
  );
}

export function AppShell() {
  const { resolved, toggle } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const key = useOpenRouterKey();
  const current = ALL_NAV.find((n) => pathname.startsWith(`/app/${n.to}`));
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col border-r bg-surface-2 p-2 md:flex lg:w-[232px] lg:p-3">
        <Logo className="hidden px-3 py-4 lg:inline-flex" />
        <span aria-hidden className="mx-auto my-5 h-5 w-[3px] rounded-full bg-ember lg:hidden" />
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => <SideLink key={item.to} item={item} />)}
          <div className="mt-auto flex flex-col gap-1 border-t pt-3">
            {FOOTER_NAV.map((item) => <SideLink key={item.to} item={item} />)}
          </div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-paper/90 px-4 backdrop-blur md:px-6">
          <Logo className="md:hidden" />
          <p className="micro hidden text-ink-3 md:block">{current?.label ?? "Growth Copilot"}</p>
          <div className="flex items-center gap-2">
            <KeyStatusPill status={key.status} model={key.model?.split("/").pop()} onClick={() => navigate("/app/settings")} />
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} theme`}>
              {resolved === "dark" ? <Sun strokeWidth={1.5} /> : <Moon strokeWidth={1.5} />}
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out"><LogOut strokeWidth={1.5} /></Button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 pb-24 md:px-6 md:py-8 md:pb-8">
          <KeyPrompt state={key} />
          <Outlet />
        </main>
      </div>
      <MobileTabs />
    </div>
  );
}
