import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, X } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { fmt, offsetLabel, parts, zonedToUtc } from "@/lib/tz";

/** A right-hand panel over the page. Escape or the backdrop closes it. */
export function Sheet({ title, onClose, children }) {
  const ref = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30 animate-fade-up" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="flex h-full w-full max-w-[400px] flex-col gap-5 overflow-y-auto bg-surface p-6 shadow-pop outline-none">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl">{title}</h2>
          <Button variant="ghost" size="icon" aria-label="Close" className="-mr-2 -mt-2" onClick={onClose}><X strokeWidth={1.5} /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const TimezoneChip = ({ tz }) => (
  <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 font-medium text-ink"><Globe aria-hidden strokeWidth={1.5} className="size-3.5 text-ink-3" />{tz} · {offsetLabel(tz)}</span>
    <span>Stored in UTC, shown in your timezone. <Link to="/app/settings" className="underline underline-offset-4">Change</Link></span>
  </p>
);

/** Picks a date and time in the user's zone and schedules (or reschedules) an approved post. */
export function ScheduleSheet({ item, tz, onClose, onDone }) {
  const start = item.scheduled_at ? parts(item.scheduled_at, tz) : { ...parts(Date.now() + 86400000, tz), time: "09:00" };
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const at = zonedToUtc(date, time, tz);
    if (!date || !time || Number.isNaN(at.getTime())) return setError("Pick a date and a time.");
    if (at <= new Date()) return setError("Pick a time in the future.");
    setBusy(true);
    setError("");
    try { onDone(await api("/calendar", { method: "POST", body: { content_id: item.id, scheduled_at: at.toISOString() } })); } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Sheet title={item.scheduled_at ? "Reschedule post" : "Schedule post"} onClose={onClose}>
      <p className="text-ink-2">{item.title}</p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Time">{(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
        </div>
        <TimezoneChip tz={tz} />
        {date && time && !Number.isNaN(zonedToUtc(date, time, tz).getTime()) && <p className="text-[13px] text-ink-2">We'll remind you on {fmt(zonedToUtc(date, time, tz), tz, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}.</p>}
        {error && <p role="alert" className="text-[13px] text-rose">{error}</p>}
        <p className="rounded-card bg-surface-2 p-3 text-[13px] leading-5 text-ink-2">At that time Copilot reminds you to post. It never posts to LinkedIn for you.</p>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Scheduling…" : item.scheduled_at ? "Reschedule" : "Schedule"}</Button>
      </form>
    </Sheet>
  );
}
