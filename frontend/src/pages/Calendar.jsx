import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/brand/EmptyState";
import { TrustNote } from "@/components/brand/TrustNote";
import { JobStatusBadge } from "@/components/calendar/JobStatusBadge";
import { ScheduleSheet, Sheet, TimezoneChip } from "@/components/calendar/ScheduleSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { STATUS } from "@/pages/Editor";
import { clock, fmt, monthCells, parts } from "@/lib/tz";

const POLL_MS = 15000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const isDue = (i) => i.status === "scheduled" && i.job?.status === "succeeded";
const when = (i, tz) => fmt(i.scheduled_at, tz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function WorkerStatus({ seen }) {
  const secs = seen ? Math.max(0, Math.round((Date.now() - new Date(seen)) / 1000)) : null;
  const quiet = secs === null || secs > 60;
  return (
    <p role="status" className={cn("text-[13px]", quiet ? "text-amber" : "text-ink-3")}>
      {secs === null ? "The scheduler hasn't reported in yet, so reminders may not fire." : quiet ? `The scheduler was last seen ${Math.round(secs / 60)} min ago. Reminders may be late.` : `Scheduler last seen ${secs} s ago`}
    </p>
  );
}

function Details({ item, tz, onClose, onReschedule, onChanged }) {
  const [error, setError] = useState("");
  const run = (fn) => async () => { setError(""); try { await fn(); onChanged(); } catch (e) { setError(e.message); } };
  const { job } = item;
  return (
    <Sheet title={item.title} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2">
        {isDue(item) ? <Badge tone="amber">Due: post it now</Badge> : <Badge tone={STATUS[item.status][0]}>{STATUS[item.status][1]}</Badge>}
        <JobStatusBadge job={job} />
      </div>
      <p>{item.status === "published" ? `Published ${fmt(item.published_at, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : when(item, tz)}</p>
      {job && item.status === "scheduled" && (
        <dl className="num grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px] text-ink-2">
          <dt>Attempts</dt><dd>{job.attempts} of {job.max_attempts}</dd>
          {job.status === "queued" && <><dt>Next run</dt><dd>{when({ scheduled_at: job.run_at }, tz)}</dd></>}
        </dl>
      )}
      {job?.last_error && <p className="rounded-card bg-rose-soft p-3 text-[13px] text-ink">Last problem: {job.last_error}</p>}
      {isDue(item) && <TrustNote tone="amber">This is due. Open the draft, copy it into LinkedIn, then mark it as published.</TrustNote>}
      <TimezoneChip tz={tz} />
      {error && <p role="alert" className="text-[13px] text-rose">{error}</p>}
      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant="secondary" asChild><Link to={`/app/studio/${item.id}`}>Open draft</Link></Button>
        {item.status === "scheduled" && (
          <>
            <Button variant="secondary" onClick={onReschedule}>Reschedule</Button>
            <Button variant="ghost" className="hover:text-rose" onClick={run(() => api(`/calendar/${item.id}`, { method: "DELETE" }))}>Cancel schedule</Button>
            <Button onClick={run(() => api(`/calendar/${item.id}/published`, { method: "POST" }))}>Mark as published</Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

const chip = (i) => cn("block w-full truncate rounded-md px-1.5 py-1 text-left text-[12px] leading-4 text-ink hover:brightness-95", i.status === "published" ? "bg-ink/10" : isDue(i) ? "bg-amber-soft" : i.job?.status === "failed" ? "bg-rose-soft" : "bg-sky-soft");

function Month({ cursor, items, tz, onOpen }) {
  const today = parts(new Date(), tz).date;
  const byDay = {};
  items.forEach((i) => (byDay[parts(i.scheduled_at, tz).date] ??= []).push(i));
  return (
    <div role="grid" aria-label="Month" className="overflow-hidden rounded-card border bg-surface">
      <div role="row" className="grid grid-cols-7 border-b bg-surface-2 text-center text-[12px] font-medium text-ink-3">{WEEKDAYS.map((d) => <div key={d} role="columnheader" className="py-2">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {monthCells(cursor.y, cursor.m).map((date, n) => (
          <div key={date ?? `b${n}`} role="gridcell" className={cn("min-h-24 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0", !date && "bg-surface-2/50")}>
            {date && <span className={cn("num mb-1 inline-grid size-6 place-items-center rounded-full text-[12px] text-ink-2", date === today && "bg-ember-strong font-semibold text-white")}>{+date.slice(8)}</span>}
            <div className="space-y-1">{(byDay[date] ?? []).map((i) => <button key={i.id} type="button" onClick={() => onOpen(i)} className={chip(i)}><span className="num mr-1 text-ink-3">{clock(i.scheduled_at, tz)}</span>{i.title}</button>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function List({ items, tz, onOpen }) {
  return (
    <ul className="divide-y divide-line rounded-card border bg-surface">
      {items.map((i) => (
        <li key={i.id}>
          <button type="button" onClick={() => onOpen(i)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface-2">
            <span className="num w-40 shrink-0 text-[13px] text-ink-2">{when(i, tz)}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{i.title}</span>
            {isDue(i) ? <Badge tone="amber">Due: post it now</Badge> : <Badge tone={STATUS[i.status][0]}>{STATUS[i.status][1]}</Badge>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Calendar() {
  const { user } = useAuth();
  const tz = user.timezone;
  const [data, setData] = useState(null);
  const [ready, setReady] = useState([]);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(() => { const p = parts(new Date(), tz); return { y: p.y, m: p.m }; });
  const [view, setView] = useState(() => (window.matchMedia?.("(max-width: 639px)").matches ? "list" : "month"));
  const [open, setOpen] = useState(null);
  const [sheet, setSheet] = useState(null);

  const load = useCallback(() => Promise.all([api("/calendar"), api("/content?status=approved")]).then(([c, r]) => { setData(c); setReady(r); setError(""); }, (e) => setError(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, [load]);

  const items = data?.items ?? [];
  const shown = open && items.find((i) => i.id === open) ; // always the freshest copy
  const step = (n) => setCursor(({ y, m }) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; });
  const changed = () => { setOpen(null); load(); };

  return (
    <>
      <PageHeader title="Calendar" description="What is scheduled, and what is ready to schedule." />
      <TrustNote className="mb-6">Copilot reminds you when a post is due. It never posts to LinkedIn for you.</TrustNote>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => step(-1)}><ChevronLeft strokeWidth={1.5} /></Button>
          <h2 className="min-w-40 text-center text-xl">{fmt(Date.UTC(cursor.y, cursor.m - 1, 1), "UTC", { month: "long", year: "numeric" })}</h2>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => step(1)}><ChevronRight strokeWidth={1.5} /></Button>
        </div>
        <Segmented label="View" value={view} onChange={setView} options={[["month", "Month"], ["list", "List"]]} />
      </div>
      {error && <p role="alert" className="mb-4 text-[13px] text-rose">{error} <Button variant="ghost" size="sm" onClick={load}>Retry</Button></p>}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          {!data && !error && <p role="status" className="py-12 text-center text-ink-3">Loading…</p>}
          {data && view === "month" && <Month cursor={cursor} items={items} tz={tz} onOpen={(i) => setOpen(i.id)} />}
          {data && view === "list" && (items.length ? <List items={items} tz={tz} onOpen={(i) => setOpen(i.id)} /> : <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Approve a draft, then pick a time for it." />)}
          {data && <div className="mt-3"><WorkerStatus seen={data.worker_seen_at} /></div>}
        </div>
        <aside aria-labelledby="ready-h">
          <h2 id="ready-h" className="mb-3 text-xl">Ready to schedule</h2>
          {ready.length === 0 ? <p className="text-ink-2">Approve a draft and it will appear here.</p> : (
            <ul className="divide-y divide-line rounded-card border bg-surface">
              {ready.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <Button size="sm" variant="secondary" aria-label={`Schedule ${r.title}`} onClick={() => setSheet(r)}>Schedule</Button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      {shown && !sheet && <Details item={shown} tz={tz} onClose={() => setOpen(null)} onReschedule={() => setSheet(shown)} onChanged={changed} />}
      {sheet && <ScheduleSheet item={sheet} tz={tz} onClose={() => setSheet(null)} onDone={() => { setSheet(null); setOpen(null); load(); }} />}
    </>
  );
}
