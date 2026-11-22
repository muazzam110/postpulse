import { Check, CircleCheck, Lightbulb, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const KIND = { claim: "Claim", example: "Example", lesson: "Lesson", idea: "Idea" };

/** What the source says (quoted and found) versus what the model inferred (no quote) versus a quote that isn't there. */
function Provenance({ insight }) {
  if (!insight.evidence) return <Badge tone="sky" icon={Lightbulb}>Interpretation</Badge>;
  return insight.grounded ? <Badge tone="moss" icon={CircleCheck}>In your source</Badge> : <Badge tone="amber" icon={TriangleAlert}>Needs your check</Badge>;
}

export function Insights({ insights, picked, onToggle }) {
  return (
    <section aria-labelledby="insights-h">
      <h2 id="insights-h" className="text-xl">What the source gives you</h2>
      <p className="mt-1 text-ink-2">Pick the ideas the post should be built around, or leave them all unselected to let Copilot choose.</p>
      <ul className="mt-4 space-y-2">
        {insights.map((i) => {
          const on = picked.has(i.text);
          return (
            <li key={i.text}>
              <button type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(i.text)}
                className={cn("flex w-full gap-3 rounded-card border bg-surface p-4 text-left transition-colors hover:border-ink-3", on && "border-ink")}>
                <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded border border-line", on && "border-ink bg-ink text-paper")}>{on && <Check strokeWidth={2.5} className="size-3.5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="micro text-ink-3">{KIND[i.kind]}</span>
                    <Provenance insight={i} />
                  </span>
                  <span className="mt-1 block">{i.text}</span>
                  {i.grounded && <span className="mt-2 block border-l-2 border-line pl-3 text-[13px] text-ink-3">{i.evidence}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Angles({ angles, chosen, onChoose }) {
  return (
    <section aria-labelledby="angles-h">
      <h2 id="angles-h" className="text-xl">Pick an angle</h2>
      <div role="radiogroup" aria-labelledby="angles-h" className="mt-4 grid gap-3 md:grid-cols-3">
        {angles.map((a) => {
          const on = chosen === a;
          return (
            <button key={a.title} type="button" role="radio" aria-checked={on} onClick={() => onChoose(on ? null : a)}
              className={cn("rounded-card border bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-ink-3", on && "border-2 border-ember")}>
              <span className="block text-[15px] font-semibold">{a.title}</span>
              <span className="mt-2 line-clamp-3 block font-display text-[15px] leading-[22px] text-ink-2">{a.hook}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
