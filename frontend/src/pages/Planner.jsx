import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarRange, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/brand/EmptyState";
import { TrustNote } from "@/components/brand/TrustNote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { TagInput } from "@/components/ui/tag-input";
import { useAuth } from "@/hooks/useAuth";
import { useAutosave } from "@/hooks/useAutosave";
import { useOpenRouterKey } from "@/hooks/useOpenRouterKey";
import { addDays, fmt, nextMonday } from "@/lib/tz";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FREQ = [1, 2, 3, 4, 5].map((n) => [String(n), String(n)]);
const dayLabel = (start, i) => fmt(`${addDays(start, i)}T12:00:00Z`, "UTC", { month: "short", day: "numeric" });

function PlanForm({ onPlan }) {
  const { user } = useAuth();
  const key = useOpenRouterKey();
  const [f, setF] = useState({ goal: "", pillars: [], audience: "", per_week: "3", week_start: nextMonday(user.timezone), use_knowledge: true });
  const [state, setState] = useState({ busy: false, error: "" });
  useEffect(() => { api("/brand").then((v) => setF((c) => ({ ...c, pillars: c.pillars.length ? c.pillars : v.pillars ?? [], audience: c.audience || v.audience || "" })), () => {}); }, []);
  const monday = f.week_start && new Date(`${f.week_start}T00:00:00Z`).getUTCDay() === 1;
  const ready = key.status === "connected" && f.goal.trim().length >= 3 && monday && !state.busy;

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, error: "" });
    try { onPlan(await api("/plans", { method: "POST", key: true, body: { ...f, per_week: +f.per_week, model: key.model } })); setState({ busy: false, error: "" }); } catch (err) { setState({ busy: false, error: err.message }); }
  }

  return (
    <form onSubmit={submit} aria-label="Plan a week" className="grid gap-5 rounded-card border bg-surface p-6 md:grid-cols-2">
      <Field label="Goal this week" className="md:col-span-2">{(p) => <Input {...p} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} maxLength={200} placeholder="Start conversations with other founders" />}</Field>
      <Field label="Content pillars" hint="Up to five. Leave empty to use your brand voice.">{(p) => <TagInput {...p} aria-label="Add a pillar" value={f.pillars} onChange={(pillars) => setF({ ...f, pillars })} placeholder="Add a pillar" />}</Field>
      <Field label="Audience">{(p) => <Input {...p} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} maxLength={300} placeholder="Early-stage founders" />}</Field>
      <div><p className="mb-1.5 text-[13px] font-medium text-ink-2">Posts per week</p><Segmented label="Posts per week" value={f.per_week} onChange={(per_week) => setF({ ...f, per_week })} options={FREQ} /></div>
      <Field label="Week starting" error={f.week_start && !monday ? "Pick a Monday." : undefined} reserve>{(p) => <Input {...p} type="date" value={f.week_start} onChange={(e) => setF({ ...f, week_start: e.target.value })} />}</Field>
      <label className="flex items-center gap-3 md:col-span-2"><input type="checkbox" checked={f.use_knowledge} onChange={(e) => setF({ ...f, use_knowledge: e.target.checked })} className="size-4 accent-ink" />Draw on my knowledge notes and earlier posts</label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <Button type="submit" size="lg" disabled={!ready} title={key.status !== "connected" ? "Connect your key first" : undefined}>
          {state.busy ? <LoaderCircle strokeWidth={1.5} className="animate-spin" /> : <Sparkles strokeWidth={1.5} />}{state.busy ? "Planning…" : "Plan my week"}
        </Button>
        {state.error && <p role="alert" className="text-[13px] text-rose">{state.error}</p>}
      </div>
    </form>
  );
}

function Card({ post, onChange, onDelete, onConvert }) {
  const input = "h-8 w-full min-w-0 rounded-md border border-line bg-surface-2 px-1.5";
  return (
    <li className="space-y-2 rounded-card border bg-surface p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-1.5">
        {post.pillar && <Badge tone="sky">{post.pillar}</Badge>}
        <span className="micro capitalize text-ink-3">{post.format}</span>
      </div>
      <textarea aria-label="Post title" rows={2} value={post.title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} className="block w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[14px] font-medium leading-5 hover:border-line focus:border-line focus:bg-surface-2" />
      <p className="px-1 text-ink-2">{post.angle}</p>
      <input type="time" aria-label="Suggested time" value={post.time} onChange={(e) => e.target.value && onChange({ time: e.target.value })} className={`${input} num`} />
      <select aria-label="Move to day" value={post.day} onChange={(e) => onChange({ day: +e.target.value })} className={input}>
        {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
      </select>
      <Button size="sm" variant="secondary" className="w-full" onClick={onConvert}>Convert to draft</Button>
      <Button size="sm" variant="ghost" className="w-full" aria-label={`Delete ${post.title}`} onClick={onDelete}><Trash2 strokeWidth={1.5} />Remove</Button>
    </li>
  );
}

function Board({ plan, onDeleted }) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState(plan.posts);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const save = useAutosave(useMemo(() => ({ posts }), [posts]), (v) => api(`/plans/${plan.id}`, { method: "PATCH", body: v }));
  const edit = (id, patch) => setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const convert = (p) => navigate("/app/studio", { state: { seed: { text: `${p.title}\n\n${p.angle}`.trim(), type: "idea", format: p.format } } });
  const remove = async () => { try { await api(`/plans/${plan.id}`, { method: "DELETE" }); onDeleted(); } catch (e) { setError(e.message); } };

  return (
    <section aria-labelledby="board-h" className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="board-h" className="text-xl">{plan.title}</h2><p className="text-ink-2">{plan.goal}</p></div>
        <div className="flex items-center gap-3">
          <span role="status" className="text-[13px] text-ink-3">{{ saving: "Saving…", saved: "Saved", error: "Couldn't save. Your edits are still here." }[save]}</span>
          {confirming ? <Button variant="destructive" size="sm" autoFocus onClick={remove} onBlur={() => setConfirming(false)}>Confirm delete plan</Button> : <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>Delete plan</Button>}
        </div>
      </div>
      {plan.context?.length > 0 && <p className="mb-3 text-[13px] text-ink-3">Drew on your notes: {plan.context.join(", ")}</p>}
      {error && <p role="alert" className="mb-3 text-[13px] text-rose">{error}</p>}
      {posts.length === 0 && <p className="text-ink-2">Every post was removed. Plan another week above.</p>}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {DAY_NAMES.map((name, i) => {
          const mine = posts.filter((p) => p.day === i);
          return (
            <section key={name} aria-label={name} className="min-w-0">
              <h3 className="mb-2 text-[13px] font-medium"><span>{name.slice(0, 3)}</span> <span className="num font-normal text-ink-3">{dayLabel(plan.week_start, i)}</span></h3>
              {mine.length ? <ul className="space-y-2">{mine.map((p) => <Card key={p.id} post={p} onChange={(patch) => edit(p.id, patch)} onDelete={() => setPosts((ps) => ps.filter((x) => x.id !== p.id))} onConvert={() => convert(p)} />)}</ul> : <p className="rounded-card border border-dashed p-3 text-center text-[12px] text-ink-3">No post</p>}
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default function Planner() {
  const [plan, setPlan] = useState(null);
  const [past, setPast] = useState([]);
  const [error, setError] = useState("");
  const loadPast = useCallback(() => api("/plans").then(setPast, (e) => setError(e.message)), []);
  useEffect(() => { loadPast(); }, [loadPast]);
  const open = async (id) => { try { setPlan(await api(`/plans/${id}`)); } catch (e) { setError(e.message); } };

  return (
    <>
      <PageHeader title="Planner" description="Plan a week of posts, edit it freely, then turn any card into a draft." />
      <TrustNote className="mb-6">Plans never publish automatically.</TrustNote>
      <PlanForm onPlan={(p) => { setPlan(p); loadPast(); }} />
      {error && <p role="alert" className="mt-4 text-[13px] text-rose">{error}</p>}
      {plan && <Board key={plan.id} plan={plan} onDeleted={() => { setPlan(null); loadPast(); }} />}
      {!plan && past.length === 0 && <EmptyState icon={CalendarRange} title="No plans yet" description="Describe your goal for the week and Copilot suggests the posts." />}
      {past.length > 0 && (
        <section aria-labelledby="past-h" className="mt-10">
          <h2 id="past-h" className="mb-3 text-xl">Past plans</h2>
          <ul className="divide-y divide-line rounded-card border bg-surface">
            {past.map((p) => (
              <li key={p.id}><button type="button" onClick={() => open(p.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2"><span className="font-medium">{p.title}</span><span className="min-w-0 truncate text-[13px] text-ink-3">{p.goal} · {p.count} post{p.count === 1 ? "" : "s"}</span></button></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
