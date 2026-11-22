import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Library as LibraryIcon } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/brand/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { STATUS } from "@/pages/Editor";

const FILTERS = [["", "All"], ["draft", "Drafts"], ["approved", "Approved"], ["scheduled", "Scheduled"], ["published", "Published"], ["rejected", "Rejected"]];
const date = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function Library() {
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(() => {
    setError("");
    return api(`/content${filter ? `?status=${filter}` : ""}`).then(setItems, (e) => setError(e.message));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function remove(id) {
    try { await api(`/content/${id}`, { method: "DELETE" }); setItems((list) => list.filter((i) => i.id !== id)); } catch (e) { setError(e.message); }
    setConfirming(null);
  }

  return (
    <>
      <PageHeader title="Library" description="Every draft you've saved, with where it stands." />
      <Segmented label="Filter by status" value={filter} onChange={(f) => { setFilter(f); setItems(null); }} options={FILTERS} />
      <div className="mt-6" aria-live="polite">
        {error && <p role="alert" className="text-[13px] text-rose">{error} <Button variant="ghost" size="sm" onClick={load}>Retry</Button></p>}
        {!items && !error && <p role="status" className="py-12 text-center text-ink-3">Loading…</p>}
        {items?.length === 0 && (
          <EmptyState icon={LibraryIcon} title={filter ? "Nothing here" : "Nothing drafted yet"} description={filter ? "No drafts have this status." : "Start from an idea, a set of notes or a transcript."}>
            {!filter && <Button asChild><Link to="/app/studio">Start from an idea</Link></Button>}
          </EmptyState>
        )}
        {items?.length > 0 && (
          <ul className="divide-y divide-line rounded-card border bg-surface">
            {items.map((i) => {
              const [tone, label] = STATUS[i.status] ?? STATUS.draft;
              return (
                <li key={i.id} className="flex items-center gap-4 px-5 py-4">
                  <Link to={`/app/studio/${i.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{i.title}</span>
                    <span className="num mt-0.5 block text-[12px] capitalize text-ink-3">{i.format} · {date(i.updated_at)}</span>
                  </Link>
                  <Badge tone={tone}>{label}</Badge>
                  {confirming === i.id
                    ? <Button variant="destructive" size="sm" onClick={() => remove(i.id)} onBlur={() => setConfirming(null)} autoFocus>Confirm delete</Button>
                    : <Button variant="ghost" size="sm" aria-label={`Delete ${i.title}`} onClick={() => setConfirming(i.id)}>Delete</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
