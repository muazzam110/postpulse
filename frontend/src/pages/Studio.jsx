import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LoaderCircle, PenLine } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";
import { TrustNote } from "@/components/brand/TrustNote";
import { Angles, Insights } from "@/components/studio/Insights";
import { Review } from "@/components/studio/Review";
import { postFields } from "@/components/studio/Quality";
import { SettingsPanel } from "@/components/studio/SettingsPanel";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useOpenRouterKey } from "@/hooks/useOpenRouterKey";
import { cn } from "@/lib/utils";

const SOURCES = [["idea", "Idea"], ["notes", "Project notes"], ["article", "Article"], ["transcript", "Transcript"]];
const MIN = 20, MAX = 20000;
const RETRYABLE = ["rate_limited", "timeout", "provider_unavailable", "network", "provider_error", "invalid_output"];
const DEFAULTS = { format: "educational", goal: "", audience: "", tone: "", length: "medium", cta_style: "question", hashtags: true, use_knowledge: true };

/** One abortable request at a time, with a label while it runs and a safe message if it fails. */
function useTask() {
  const [state, setState] = useState({ name: "idle" });
  const ctrl = useRef();
  useEffect(() => () => ctrl.current?.abort(), []);
  const run = async (label, fn) => {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setState({ name: "working", label });
    try {
      const result = await fn(ctrl.current.signal);
      setState({ name: "idle" });
      return result;
    } catch (e) {
      setState(e.name === "AbortError" ? { name: "idle" } : { name: "error", code: e.code, message: e.message });
    }
  };
  return { state, run, cancel: () => ctrl.current?.abort() };
}

export default function Studio() {
  const navigate = useNavigate();
  const key = useOpenRouterKey();
  const task = useTask();
  const seed = useLocation().state?.seed; // "Convert to draft" in the planner arrives with a starting point
  const [source, setSource] = useState({ text: seed?.text ?? "", type: seed?.type ?? "idea" });
  const [cfg, setCfg] = useState({ ...DEFAULTS, ...(seed?.format && { format: seed.format }) });
  const [voice, setVoice] = useState(null);
  const [found, setFound] = useState(null); // { insights, angles }
  const [picked, setPicked] = useState(() => new Set());
  const [angle, setAngle] = useState(null);
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState(null); // { drafts, active }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/brand").then((v) => { setVoice(v); setCfg((c) => ({ ...c, audience: c.audience || v.audience })); }, () => {});
  }, []);

  const connected = key.status === "connected";
  const length = source.text.trim().length;
  const ready = connected && length >= MIN && length <= MAX;
  const working = task.state.name === "working";
  const base = { source_text: source.text, source_type: source.type, model: key.model };
  const noteRemoved = (n) => setNotice(n ? `Removed ${n} timestamp${n > 1 ? "s" : ""} from the transcript.` : "");

  async function extract() {
    const res = await task.run("Reading your source…", (signal) => api("/ai/summarize", { method: "POST", body: base, key: true, signal }));
    if (!res) return;
    setFound(res);
    setPicked(new Set());
    setAngle(null);
    noteRemoved(res.removed_timestamps);
  }

  async function generate() {
    const body = { ...base, ...cfg, angle: angle ? `${angle.title}: ${angle.hook}` : "", insights: [...picked] };
    const res = await task.run("Drafting three versions…", (signal) => api("/ai/generate", { method: "POST", body, key: true, signal }));
    if (!res) return;
    // the checks the server already ran travel with each draft, tagged with the text they were about
    setReview({ drafts: res.drafts.map(({ similar, avoid_hits, ...d }) => ({ ...d, review: { result: { similar, avoid_hits }, snap: postFields(d) } })), context: res.context, active: 0 });
    noteRemoved(res.removed_timestamps);
    window.scrollTo?.({ top: 0 });
  }

  async function save() {
    const d = review.drafts[review.active];
    setSaving(true);
    const body = { ...postFields(d), source_claims: d.source_claims, source_text: source.text, source_type: source.type, format: cfg.format };
    const item = await task.run("Saving…", () => api("/content", { method: "POST", body }));
    if (item) navigate(`/app/studio/${item.id}`);
    else setSaving(false);
  }

  const edit = (next) => setReview((r) => ({ ...r, drafts: r.drafts.map((d, i) => (i === r.active ? next : d)) }));
  const setReviewOf = (at, review) => setReview((r) => ({ ...r, drafts: r.drafts.map((d, i) => (i === at ? { ...d, review } : d)) }));
  const err = task.state.name === "error" ? task.state : null;

  if (review) {
    return (
      <>
        <PageHeader title="Your drafts" description="Three takes on the same source. Edit any of them, then save the one you want." />
        {notice && <TrustNote className="mx-auto mb-6 max-w-[680px]">{notice}</TrustNote>}
        {working && !saving && <p role="status" className="mx-auto mb-6 flex max-w-[680px] items-center gap-2 text-ink-2"><LoaderCircle strokeWidth={1.5} className="size-4 animate-spin" />{task.state.label}</p>}
        {err && <p role="alert" className={cn("mx-auto mb-6 max-w-[680px] text-[13px]", RETRYABLE.includes(err.code) ? "text-amber" : "text-rose")}>{err.message}</p>}
        <Review drafts={review.drafts} active={review.active} context={review.context} source={source.text} onReview={setReviewOf} busy={saving || working}
          onActive={(active) => setReview({ ...review, active })} onEdit={edit} onSave={save}
          onBack={() => setReview(null)} onRegenerate={generate} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Content Studio" description="Paste what you have. Copilot turns it into drafts that stay close to your source." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-8">
          <section aria-labelledby="source-h">
            <h2 id="source-h" className="sr-only">Source</h2>
            <Segmented label="Source type" value={source.type} onChange={(type) => setSource({ ...source, type })} options={SOURCES} />
            <div className="relative mt-4">
              <textarea
                aria-label="Source text"
                value={source.text}
                onChange={(e) => setSource({ ...source, text: e.target.value })}
                maxLength={MAX}
                placeholder="Paste an idea, project notes, an article or a transcript"
                className="min-h-[220px] w-full resize-y rounded-card border border-line bg-surface-2 p-4 pb-9 text-[15px] leading-6 placeholder:text-ink-3 focus:bg-surface"
              />
              <span className={cn("num absolute bottom-3 right-4 text-[12px]", length && length < MIN ? "text-amber" : "text-ink-3")}>
                {length.toLocaleString()} / {MAX.toLocaleString()}{length < MIN && ` · at least ${MIN}`}
              </span>
            </div>
            <Button variant="secondary" className="mt-3" onClick={extract} disabled={!ready || working}>Extract insights</Button>
          </section>
          {found && <Insights insights={found.insights} picked={picked} onToggle={(t) => setPicked((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; })} />}
          {found && <Angles angles={found.angles} chosen={angle} onChoose={setAngle} />}
        </div>
        <SettingsPanel cfg={cfg} set={(patch) => setCfg({ ...cfg, ...patch })} voice={voice} />
      </div>

      <div className="sticky bottom-16 z-10 mt-8 flex flex-wrap items-center justify-end gap-4 border-t bg-paper/95 py-4 backdrop-blur md:bottom-0">
        <div className="mr-auto min-w-0" aria-live="polite">
          {working && <p className="flex items-center gap-2 text-ink-2"><LoaderCircle strokeWidth={1.5} className="size-4 animate-spin" />{task.state.label} <span className="text-ink-3">This can take up to half a minute.</span></p>}
          {err && (
            <p role="alert" className={cn("text-[13px]", RETRYABLE.includes(err.code) ? "text-amber" : "text-rose")}>
              {err.message}{" "}
              {["key_required", "invalid_key"].includes(err.code) && <Link to="/app/settings" className="font-medium underline underline-offset-4">Open settings</Link>}
            </p>
          )}
          {!working && !err && notice && <p className="text-[13px] text-ink-3">{notice}</p>}
        </div>
        {working && <Button variant="ghost" onClick={task.cancel}>Cancel</Button>}
        <Button size="lg" onClick={generate} disabled={!ready || working} title={!ready ? (connected ? `Add at least ${MIN} characters of source text` : "Connect your key first") : undefined}>
          <PenLine strokeWidth={1.5} />Generate 3 drafts
        </Button>
      </div>
    </>
  );
}
