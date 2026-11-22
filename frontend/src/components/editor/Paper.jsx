import { useLayoutEffect, useRef } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";

const SEE_MORE_AT = 210; // LinkedIn folds a post after roughly this many characters

const hashtag = (t) => "#" + t.replace(/^#+/, "").replace(/\W/g, "");

function Grow({ value, onChange, label, className, ...props }) {
  const ref = useRef();
  useLayoutEffect(() => {
    ref.current.style.height = "auto";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("block w-full resize-none bg-transparent outline-none placeholder:text-ink-3", className)}
      {...props}
    />
  );
}

const Label = ({ children }) => <p className="micro mb-2 text-ink-3">{children}</p>;

export function Claims({ claims }) {
  if (!claims?.length) return null;
  return (
    <section aria-labelledby="claims-h" className="mx-auto mt-6 max-w-[680px] rounded-card border bg-surface p-5">
      <h2 id="claims-h" className="text-lg">Source check</h2>
      <ul className="mt-3 divide-y divide-line">
        {claims.map((c) => (
          <li key={c.text} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <p>{c.text}</p>
              {c.supported ? <Badge tone="moss" icon={CircleCheck}>In your source</Badge> : <Badge tone="amber" icon={TriangleAlert}>Needs your check</Badge>}
            </div>
            {c.supported && <blockquote className="border-l-2 border-line pl-3 text-[13px] text-ink-3">{c.evidence}</blockquote>}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-ink-3">Checked against the text you pasted. It can't tell whether the source itself is right.</p>
    </section>
  );
}

/** The draft as one editable page. `value` is { hook, body, cta, hashtags }. */
export function Paper({ value, onChange, claims }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const over = value.hook.length > SEE_MORE_AT;
  return (
    <>
      <article className="mx-auto max-w-[680px] space-y-8 rounded-sheet border bg-surface px-6 py-8 md:px-14 md:py-12">
        <div>
          <Label>Hook</Label>
          <Grow label="Hook" value={value.hook} onChange={(hook) => set({ hook })} maxLength={300} placeholder="The first line decides whether anyone reads on" className="font-display text-2xl font-semibold leading-8" />
          <p className={cn("num mt-2 text-[12px]", over ? "text-amber" : "text-ink-3")}>
            {value.hook.length} characters · {over ? "the rest folds behind “see more”" : `about ${SEE_MORE_AT} show before “see more”`}
          </p>
        </div>
        <div>
          <Label>Body</Label>
          <Grow label="Body" value={value.body} onChange={(body) => set({ body })} maxLength={3000} placeholder="Say the thing plainly" className="text-[17px] leading-7" />
        </div>
        <div className="border-l-2 border-ember pl-4">
          <Label>Call to action</Label>
          <Grow label="Call to action" value={value.cta} onChange={(cta) => set({ cta })} maxLength={300} placeholder="Optional" className="text-[17px] leading-7" />
        </div>
        <div>
          <Label>Hashtags</Label>
          <TagInput aria-label="Add a hashtag" value={value.hashtags} onChange={(hashtags) => set({ hashtags })} normalize={hashtag} maxLength={40} placeholder="Add a hashtag" />
        </div>
      </article>
      <Claims claims={claims} />
    </>
  );
}
