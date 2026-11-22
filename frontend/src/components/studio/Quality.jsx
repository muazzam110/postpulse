import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, LoaderCircle, Repeat2, Sparkles, TriangleAlert } from "lucide-react";
import { api } from "@/api/client";
import { ScoreRing } from "@/components/brand/ScoreRing";
import { Button } from "@/components/ui/button";
import { useOpenRouterKey } from "@/hooks/useOpenRouterKey";
import { cn } from "@/lib/utils";

const CRITERIA = [["hook", "Hook"], ["clarity", "Clarity"], ["specificity", "Specificity"], ["voice_fit", "Voice fit"], ["cta", "Call to action"]];
export const postFields = (p) => ({ hook: p.hook, body: p.body, cta: p.cta, hashtags: p.hashtags });
const same = (a, b) => JSON.stringify(postFields(a)) === JSON.stringify(postFields(b));

const List = ({ title, items }) => items?.length > 0 && (
  <div><p className="micro mb-1.5 text-ink-3">{title}</p><ul className="list-disc space-y-1 pl-4 text-[14px] text-ink-2">{items.map((s) => <li key={s}>{s}</li>)}</ul></div>
);

/**
 * What can be said about one draft: checks the server does itself (repeats, words to avoid) and an optional 1-5 review from the model.
 * `review` is { result, snap }: the answer and the text it was about. Edit the text and the answer is marked out of date, not hidden.
 */
export function Quality({ post, review, onReview, contentId, sourceText, claims }) {
  const key = useOpenRouterKey();
  const [state, setState] = useState({ busy: false, error: "" });
  const result = review?.result;
  const stale = review && !same(review.snap, post);
  const ready = key.status === "connected" && post.hook.trim() && post.body.trim() && !state.busy;

  async function run() {
    const snap = postFields(post);
    setState({ busy: true, error: "" });
    try {
      const body = { ...snap, model: key.model, source_text: sourceText || null, content_id: contentId, source_claims: claims ?? [] };
      onReview({ result: await api("/ai/evaluate", { method: "POST", body, key: true }), snap });
      setState({ busy: false, error: "" });
    } catch (e) {
      setState({ busy: false, error: e.message });
    }
  }

  const clean = result && !result.similar?.length && !result.avoid_hits?.length;
  return (
    <section aria-labelledby="quality-h" className="mx-auto mt-6 max-w-[680px] rounded-card border bg-surface p-5">
      <h2 id="quality-h" className="text-lg">Quality check</h2>
      {stale && <p role="status" className="mt-3 flex gap-2 text-[13px] text-amber"><TriangleAlert aria-hidden strokeWidth={1.5} className="mt-px size-4 shrink-0" />You've edited this since the last check. Check again to refresh it.</p>}
      <div className={cn("mt-3 space-y-4", stale && "opacity-60")}>
        {result?.similar?.map((s) => (
          <p key={s.id} className="flex gap-2 text-[14px]"><Repeat2 aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-amber" />
            <span>Close to your earlier post <Link to={`/app/studio/${s.id}`} className="font-medium underline underline-offset-4">{s.title}</Link> ({Math.round(s.similarity * 100)}% of its phrases repeat).</span></p>
        ))}
        {result?.avoid_hits?.length > 0 && <p className="flex gap-2 text-[14px]"><TriangleAlert aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-amber" />Uses words from your avoid list: {result.avoid_hits.join(", ")}.</p>}
        {clean && <p className="flex gap-2 text-[14px] text-ink-2"><CircleCheck aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-moss" />No close repeats of your earlier posts, and none of your avoided words.</p>}
        {result?.scores && (
          <>
            <div className="flex items-center gap-5">
              <ScoreRing value={result.overall} label="Overall score" size={72} />
              <ul className="min-w-0 flex-1 space-y-2">
                {CRITERIA.map(([k, label]) => (
                  <li key={k} className="flex items-center gap-3 text-[13px]">
                    <span className="w-28 shrink-0 text-ink-2">{label}</span>
                    <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-ink" style={{ width: `${result.scores[k] * 20}%` }} /></span>
                    <span className="num w-8 text-right">{result.scores[k]}/5</span>
                  </li>
                ))}
              </ul>
            </div>
            <List title="What works" items={result.strengths} />
            <List title="What to improve" items={result.improvements} />
            {result.unsupported_claims > 0 && <p className="text-[13px] text-amber">{result.unsupported_claims} claim{result.unsupported_claims > 1 ? "s" : ""} in this draft can't be found in your source.</p>}
          </>
        )}
      </div>
      {!result?.scores && <p className="mt-3 text-ink-2">Get a second opinion on the hook, clarity, specificity, voice and call to action.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={run} disabled={!ready} title={key.status !== "connected" ? "Connect your key to score drafts" : undefined}>
          {state.busy ? <LoaderCircle strokeWidth={1.5} className="animate-spin" /> : <Sparkles strokeWidth={1.5} />}
          {state.busy ? "Checking…" : result?.scores ? "Check again" : "Score this draft"}
        </Button>
        {state.error && <p role="alert" className="text-[13px] text-rose">{state.error}</p>}
      </div>
      <p className="mt-4 text-[13px] text-ink-3">A second opinion from the model you chose. It is advice, not a prediction of how the post will perform.</p>
    </section>
  );
}
