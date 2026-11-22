import { useCallback, useEffect, useState } from "react";
import { BookMarked, CircleCheck } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/brand/EmptyState";
import { TrustNote } from "@/components/brand/TrustNote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useOpenRouterKey } from "@/hooks/useOpenRouterKey";

const MIN = 20, MAX = 20000;
const saved = (r) => r.indexed ? "Saved and indexed. Copilot can now find it by meaning."
  : r.warning ? `Saved, but it isn't indexed yet: ${r.warning} Keyword search still finds it, and you can index it again below.`
  : "Saved. Connect your key to index it for smarter search. Keyword search works in the meantime.";

export default function Knowledge() {
  const connected = useOpenRouterKey().status === "connected";
  const [docs, setDocs] = useState(null);
  const [form, setForm] = useState({ title: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(() => api("/knowledge").then(setDocs, (e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const act = (fn) => async (...args) => {
    setBusy(true);
    setError("");
    setMsg("");
    try { await fn(...args); await load(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const add = act(async (e) => {
    e.preventDefault();
    const r = await api("/knowledge", { method: "POST", body: { title: form.title.trim(), text: form.text }, key: connected || undefined });
    setForm({ title: "", text: "" });
    setMsg(saved(r));
  });
  const reindex = act(async () => {
    const r = await api("/knowledge/reindex", { method: "POST", key: true });
    setMsg(`Indexed ${r.indexed} section${r.indexed === 1 ? "" : "s"}${r.remaining ? `. ${r.remaining} left to go, run it again.` : "."}`);
  });
  const remove = act(async (id) => { await api(`/knowledge/${id}`, { method: "DELETE" }); setConfirming(null); });

  const pending = docs?.filter((d) => !d.indexed).length ?? 0;
  const valid = form.title.trim() && form.text.trim().length >= MIN;
  return (
    <>
      <PageHeader title="Knowledge" description="Notes Copilot can draw on when it writes: past projects, lessons, how you explain things." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <form onSubmit={add} className="space-y-4" aria-label="Add a note">
          <Field label="Title">{(p) => <Input {...p} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={100} placeholder="Onboarding rewrite, 2025" />}</Field>
          <Field label="Note" hint={`${form.text.trim().length.toLocaleString()} / ${MAX.toLocaleString()} · at least ${MIN}`}>
            {(p) => <textarea {...p} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} maxLength={MAX} placeholder="Paste what you want Copilot to remember" className="min-h-[180px] w-full resize-y rounded-card border border-line bg-surface-2 p-4 text-[15px] leading-6 placeholder:text-ink-3 focus:bg-surface" />}
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!valid || busy}>{busy ? "Working…" : "Save note"}</Button>
            <p role="status" className="min-w-0 flex-1 text-[13px] text-ink-2">{msg}</p>
          </div>
          {error && <p role="alert" className="text-[13px] text-rose">{error}</p>}
          <TrustNote>Your notes stay in your account and are never shown to anyone else. To index them, their text goes to OpenRouter using your key.</TrustNote>
        </form>

        <section aria-labelledby="notes-h">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="notes-h" className="text-xl">Your notes</h2>
            {pending > 0 && <Button variant="secondary" size="sm" onClick={() => reindex()} disabled={!connected || busy} title={connected ? undefined : "Connect your key to index notes"}>Index {pending} note{pending > 1 ? "s" : ""}</Button>}
          </div>
          {!docs && !error && <p role="status" className="py-8 text-center text-ink-3">Loading…</p>}
          {docs?.length === 0 && <EmptyState icon={BookMarked} title="No notes yet" description="Add one and Copilot will use it, when relevant, in what it drafts." />}
          {docs?.length > 0 && (
            <ul className="divide-y divide-line rounded-card border bg-surface">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.title}</p><p className="num text-[12px] text-ink-3">{d.chunks} section{d.chunks > 1 ? "s" : ""}</p></div>
                  {d.indexed ? <Badge tone="moss" icon={CircleCheck}>Indexed</Badge> : <Badge>Keyword only</Badge>}
                  {confirming === d.id
                    ? <Button variant="destructive" size="sm" onClick={() => remove(d.id)} onBlur={() => setConfirming(null)} autoFocus>Confirm delete</Button>
                    : <Button variant="ghost" size="sm" aria-label={`Delete ${d.title}`} onClick={() => setConfirming(d.id)}>Delete</Button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
