import { useEffect, useState } from "react";
import { Check, Clock, Eye, Server, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TrustNote } from "@/components/brand/TrustNote";
import { whyNoKey } from "@/components/brand/keyMessages";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { loadModels, useOpenRouterKey } from "@/hooks/useOpenRouterKey";
import { zoneList } from "@/lib/tz";
import { cn } from "@/lib/utils";

const TRANSIENT = ["rate_limited", "timeout", "provider_unavailable", "network", "provider_error"];
const TRUST = [
  [ShieldCheck, "Your key stays in this browser tab's memory. We never save it to our database."],
  [Server, "We send it over HTTPS only to OpenRouter, and only when you run an action."],
  [Clock, "Closing or refreshing the tab clears it."],
  [Wallet, "You're trusting this app with your credential. Monitor usage in your OpenRouter dashboard and set a spend limit there."],
];

function KeyCard() {
  const k = useOpenRouterKey();
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState({ name: "idle" }); // idle | checking | error
  const [replacing, setReplacing] = useState(false);
  const [models, setModels] = useState([]);
  useEffect(() => { loadModels().then(setModels, () => {}); }, []);

  const connected = k.status === "connected";
  const form = !connected || replacing;
  const checking = phase.name === "checking";

  async function submit(e) {
    e.preventDefault();
    setPhase({ name: "checking" });
    try {
      await k.connect(value.trim());
      setValue(""); // don't leave the key sitting in component state or the DOM
      setReplacing(false);
      setPhase({ name: "idle" });
    } catch (err) {
      setPhase({ name: "error", code: err.code, message: err.message });
    }
  }

  return (
    <section aria-labelledby="key-h" className="rounded-card border bg-surface p-6">
      <h2 id="key-h" className="text-xl">OpenRouter key</h2>
      <p className="mt-1 text-ink-2">Copilot writes with your own OpenRouter account, so you control the cost.</p>
      {k.status === "reconnect" && !replacing && (
        <TrustNote tone="amber" className="mt-5">{whyNoKey(k)} For your security, a key lives only in this tab's memory.</TrustNote>
      )}
      {form ? (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label={replacing ? "New key" : "API key"} hint={<a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Get a key from OpenRouter ↗</a>}>
            {(p) => <Input {...p} type="password" autoComplete="off" spellCheck={false} disabled={checking} value={value} onChange={(e) => setValue(e.target.value)} placeholder="sk-or-…" className="num" />}
          </Field>
          {phase.name === "error" && (
            <p role="alert" className={cn("text-[13px]", TRANSIENT.includes(phase.code) ? "text-amber" : "text-rose")}>{phase.message}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={checking || !value.trim()}>{checking ? "Checking key…" : "Connect"}</Button>
            {replacing && <Button type="button" variant="ghost" onClick={() => { setReplacing(false); setValue(""); setPhase({ name: "idle" }); }}>Cancel</Button>}
          </div>
        </form>
      ) : (
        <div className="mt-6 space-y-4 animate-fade-up">
          <Field label="Connected key">
            {(p) => (
              <div className="relative">
                <Input {...p} readOnly value={k.masked} className="num pr-10" />
                <Check strokeWidth={2} aria-hidden className="absolute right-3 top-3 size-4 text-moss" />
              </div>
            )}
          </Field>
          <Field label="Model">
            {(p) => (
              <select {...p} value={k.model ?? ""} onChange={(e) => k.setModel(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-[15px] focus:bg-surface">
                {models.map((m) => <option key={m.id} value={m.id}>{`${m.name} · ${"¢".repeat(m.cost)}${m.recommended ? " · Recommended" : ""}`}</option>)}
              </select>
            )}
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setReplacing(true)}>Replace</Button>
            <Button variant="ghost" onClick={k.disconnect}>Disconnect</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function TrustPanel() {
  return (
    <aside aria-labelledby="trust-h" className="rounded-card bg-surface-2 p-6">
      <h2 id="trust-h" className="text-xl">How we handle your key</h2>
      <ul className="mt-4 space-y-4">
        {TRUST.map(([Icon, text]) => (
          <li key={text} className="flex gap-3 text-ink-2">
            <Icon strokeWidth={1.5} className="mt-0.5 size-[18px] shrink-0 text-ink" />
            {text}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Account() {
  const { user, logout, setTimezone } = useAuth();
  const [note, setNote] = useState("");
  const zones = zoneList(user.timezone);
  const change = (e) => { setNote("Saving…"); setTimezone(e.target.value).then(() => setNote("Saved"), (err) => setNote(err.message)); };
  return (
    <section aria-labelledby="acct-h" className="max-w-md rounded-card border bg-surface p-6">
      <h2 id="acct-h" className="text-xl">Account</h2>
      <p className="micro mt-5 text-ink-3">Email</p>
      <p className="mt-1">{user.email}</p>
      <Field label="Timezone" hint="Schedules are stored in UTC and shown in this zone." className="mt-5">
        {(p) => <select {...p} value={user.timezone} onChange={change} className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-[15px] focus:bg-surface">{zones.map((z) => <option key={z}>{z}</option>)}</select>}
      </Field>
      <p role="status" className="mt-1.5 min-h-5 text-[13px] text-ink-3">{note}</p>
      <Button variant="secondary" className="mt-6" onClick={logout}>Log out</Button>
    </section>
  );
}

const TABS = [["openrouter", "OpenRouter"], ["account", "Account"]];

export default function Settings() {
  const [tab, setTab] = useState("openrouter");
  return (
    <>
      <PageHeader title="Settings" description="Your account and the OpenRouter key Copilot writes with." />
      <div role="tablist" aria-label="Settings sections" className="mb-8 flex gap-6 border-b">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn("-mb-px border-b-2 border-transparent pb-3 font-medium text-ink-3 hover:text-ink", tab === id && "border-ink text-ink")}>
            {label}
          </button>
        ))}
      </div>
      {tab === "openrouter" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <KeyCard />
          <TrustPanel />
        </div>
      ) : (
        <Account />
      )}
    </>
  );
}
