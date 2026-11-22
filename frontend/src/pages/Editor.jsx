import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CircleCheck, FileText } from "lucide-react";
import { api } from "@/api/client";
import { Paper } from "@/components/editor/Paper";
import { ScheduleSheet } from "@/components/calendar/ScheduleSheet";
import { Quality } from "@/components/studio/Quality";
import { EmptyState } from "@/components/brand/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAutosave } from "@/hooks/useAutosave";
import { fmt } from "@/lib/tz";

export const STATUS = { draft: ["neutral", "Draft"], approved: ["moss", "Approved"], rejected: ["rose", "Rejected"], scheduled: ["sky", "Scheduled"], published: ["neutral", "Published"] };
const SAVE_LABEL = { saving: "Saving…", saved: "Saved", error: "Couldn't save. Your edits are still here." };
const fields = (i) => ({ hook: i.hook, body: i.body, cta: i.cta, hashtags: i.hashtags });

export default function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const [scheduling, setScheduling] = useState(false);
  const [item, setItem] = useState(undefined); // undefined = loading, null = missing
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [review, setReview] = useState(null); // { result, snap }: the quality check and the text it was about
  const [history, setHistory] = useState([]);
  const [reason, setReason] = useState(null); // null = not rejecting; a string = the reason being typed
  const save = useAutosave(draft, (v) => api(`/content/${id}`, { method: "PATCH", body: v }));

  useEffect(() => {
    const ctrl = new AbortController();
    api(`/content/${id}`, { signal: ctrl.signal }).then(
      (i) => { setItem(i); setDraft(fields(i)); setReview(i.evaluation ? { result: i.evaluation, snap: fields(i) } : null); },
      (e) => e.name !== "AbortError" && (e.status === 404 ? setItem(null) : setError(e.message)),
    );
    api(`/content/${id}/feedback`, { signal: ctrl.signal }).then(setHistory, () => {});
    return () => ctrl.abort();
  }, [id]);

  async function setStatus(status, comment) {
    setError("");
    try {
      setItem(await api(`/content/${id}`, { method: "PATCH", body: { status, ...(comment?.trim() && { comment }) } }));
      setReason(null);
      api(`/content/${id}/feedback`).then(setHistory, () => {});
      return true;
    } catch (e) { setError(e.message); }
  }

  if (item === null) {
    return <EmptyState icon={FileText} title="That draft doesn't exist" description="It may have been deleted."><Button asChild><Link to="/app/library">Back to Library</Link></Button></EmptyState>;
  }
  if (!item || !draft) return <p role="status" className="py-16 text-center text-ink-3">{error || "Loading…"}</p>;

  const [tone, label] = STATUS[item.status] ?? STATUS.draft;
  return (
    <>
      <div className="mx-auto mb-6 flex max-w-[680px] items-center justify-between gap-4">
        <Button variant="ghost" asChild><Link to="/app/library"><ArrowLeft strokeWidth={1.5} />Library</Link></Button>
        <div className="flex items-center gap-3">
          <span role="status" className="text-[13px] text-ink-3">{SAVE_LABEL[save]}</span>
          <Badge tone={tone} icon={item.status === "approved" ? CircleCheck : undefined}>{item.status === "scheduled" ? `Scheduled · ${fmt(item.scheduled_at, user.timezone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : label}</Badge>
        </div>
      </div>
      <Paper value={draft} onChange={setDraft} claims={item.source_claims} />
      <Quality post={draft} review={review} onReview={setReview} contentId={id} claims={item.source_claims} />
      <div className="mx-auto mt-6 flex max-w-[680px] flex-wrap items-center justify-between gap-3">
        <p role="alert" className="text-[13px] text-rose">{error}</p>
        <div className="flex gap-2">
          {item.status === "draft" && reason === null && (
            <>
              <Button variant="ghost" className="hover:text-rose" onClick={() => setReason("")}>Reject</Button>
              <Button variant="secondary" onClick={() => setStatus("approved")}>Approve</Button>
              <Button onClick={async () => (await setStatus("approved")) && setScheduling(true)}>Approve &amp; schedule</Button>
            </>
          )}
          {["approved", "scheduled", "rejected"].includes(item.status) && <Button variant="secondary" onClick={() => setStatus("draft")}>Move back to draft</Button>}
          {["approved", "scheduled"].includes(item.status) && <Button onClick={() => setScheduling(true)}>{item.status === "scheduled" ? "Reschedule" : "Schedule"}</Button>}
        </div>
      </div>
      {reason !== null && item.status === "draft" && (
        <div className="mx-auto mt-4 max-w-[680px] rounded-card border bg-surface p-4">
          <label htmlFor="reason" className="mb-1.5 block text-[13px] font-medium text-ink-2">What was wrong with it? <span className="font-normal text-ink-3">Optional. Copilot avoids it next time.</span></label>
          <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} placeholder="Too salesy, the hook is vague…" className="w-full resize-none rounded-lg border border-line bg-surface-2 p-3 text-[15px] placeholder:text-ink-3 focus:bg-surface" />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReason(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => setStatus("rejected", reason)}>Reject draft</Button>
          </div>
        </div>
      )}
      {scheduling && <ScheduleSheet item={item} tz={user.timezone} onClose={() => setScheduling(false)} onDone={(e) => { setItem((i) => ({ ...i, status: "scheduled", scheduled_at: e.scheduled_at })); setScheduling(false); }} />}
      {history.length > 0 && (
        <section aria-labelledby="history-h" className="mx-auto mt-6 max-w-[680px]">
          <h2 id="history-h" className="micro mb-2 text-ink-3">History</h2>
          <ul className="space-y-1 text-[13px] text-ink-2">
            {history.map((h, i) => <li key={i}><span className="font-medium capitalize text-ink">{h.action}</span>{h.comment && ` · ${h.comment}`}</li>)}
          </ul>
        </section>
      )}
    </>
  );
}
