import { ArrowLeft, BookMarked, RefreshCw } from "lucide-react";
import { Paper } from "@/components/editor/Paper";
import { Quality } from "@/components/studio/Quality";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The generated variants as tabs over one editable Paper. Nothing is stored until the user saves one. */
export function Review({ drafts, active, context = [], source, onActive, onEdit, onReview, onBack, onRegenerate, onSave, busy }) {
  const draft = drafts[active];
  const titles = context.filter((c, i) => context.findIndex((x) => x.title === c.title) === i); // best-ranked chunk per note
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}><ArrowLeft strokeWidth={1.5} />Back to source</Button>
        <div role="tablist" aria-label="Draft variants" className="flex gap-1 rounded-lg bg-surface-2 p-1">
          {drafts.map((_, i) => (
            <button key={i} role="tab" type="button" aria-selected={i === active} onClick={() => onActive(i)}
              className={cn("h-8 rounded-md px-4 text-[13px] font-medium text-ink-2 hover:text-ink", i === active && "bg-surface text-ink shadow-sm")}>
              {`Draft ${"ABC"[i]}`}
            </button>
          ))}
        </div>
        <Button variant="secondary" onClick={onRegenerate} disabled={busy}><RefreshCw strokeWidth={1.5} />Regenerate</Button>
      </div>
      {titles.length > 0 && (
        <p className="mx-auto mb-4 flex max-w-[680px] flex-wrap items-center gap-2 text-[13px] text-ink-3">
          Drew on your notes:
          {titles.map((c) => <span key={c.id} title={c.snippet} className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-2 px-2.5 font-medium text-ink"><BookMarked aria-hidden strokeWidth={1.75} className="size-3.5 text-ink-3" />{c.title}</span>)}
        </p>
      )}
      <Paper value={draft} onChange={onEdit} claims={draft.source_claims} />
      <Quality post={draft} review={draft.review} onReview={(r) => onReview(active, r)} sourceText={source} claims={draft.source_claims} />
      <div className="mx-auto mt-6 flex max-w-[680px] items-center justify-between gap-4">
        <p className="text-[13px] text-ink-3">Not saved yet. Edit freely, then keep the one you like.</p>
        <Button size="lg" onClick={onSave} disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button>
      </div>
    </div>
  );
}
