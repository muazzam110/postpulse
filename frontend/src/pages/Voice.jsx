import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { useAutosave } from "@/hooks/useAutosave";
import { cn } from "@/lib/utils";

const TONES = ["Direct", "Warm", "Witty", "Analytical", "Humble", "Bold"];
const STRUCTURES = [["", "No preference", "Let Copilot choose"], ["story", "Story", "Hook, story, lesson, call to action"], ["steps", "Steps", "Hook, numbered steps, call to action"], ["contrarian", "Contrarian", "A take, the evidence, the takeaway"], ["qa", "Q&A", "Question, answer, example"]];
const SAVE_LABEL = { saving: "Saving…", saved: "Saved", error: "Couldn't save. Your changes are still here." };
const words = (s) => s.split(",").map((w) => w.trim()).filter(Boolean);
const filled = (v) => [v.tone, v.audience, v.expertise || v.pillars.length, v.structure, v.avoid.length, v.examples.some((e) => e.trim())].filter(Boolean).length;
// Blank example boxes are a work in progress, not data: the API (rightly) refuses empty examples.
const toApi = (v) => ({ ...v, examples: v.examples.filter((e) => e.trim()) });

const Section = ({ title, hint, children }) => (
  <section className="rounded-card border bg-surface p-6">
    <h2 className="text-xl">{title}</h2>
    {hint && <p className="mt-1 text-ink-2">{hint}</p>}
    <div className="mt-5 space-y-4">{children}</div>
  </section>
);

export default function Voice() {
  const [v, setV] = useState(null);
  const [error, setError] = useState("");
  const status = useAutosave(v, (value) => api("/brand", { method: "PUT", body: toApi(value) }));
  useEffect(() => { api("/brand").then(setV, (e) => setError(e.message)); }, []);

  if (!v) return <p role="status" className="py-16 text-center text-ink-3">{error || "Loading…"}</p>;
  const set = (patch) => setV({ ...v, ...patch });
  const text = (name) => ({ value: v[name], onChange: (e) => set({ [name]: e.target.value }) });
  const toggleTone = (t) => { const list = words(v.tone); set({ tone: (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]).join(", ") }); };
  const setExample = (i, value) => set({ examples: v.examples.map((e, j) => (j === i ? value : e)) });
  const strength = filled(v);

  return (
    <>
      <PageHeader title="Brand voice" description="Describe how you write. Copilot uses this as context for every draft. It doesn't train a model." />
      <div className="mb-8 max-w-3xl" aria-live="polite">
        <div className="flex items-center justify-between text-[13px]">
          <p>Voice strength: <span className="num font-medium">{strength}/6</span> sections</p>
          <span role="status" className="text-ink-3">{SAVE_LABEL[status]}</span>
        </div>
        <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-line"><div className="h-full bg-ink transition-all" style={{ width: `${(strength / 6) * 100}%` }} /></div>
      </div>
      <div className="max-w-3xl space-y-6">
        <Section title="Tone" hint="Pick a few, or describe it in your own words.">
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => {
              const on = words(v.tone).includes(t);
              return <button key={t} type="button" aria-pressed={on} onClick={() => toggleTone(t)} className={cn("h-8 rounded-full border border-line px-4 text-[13px] font-medium text-ink-2 hover:text-ink", on && "border-ink bg-ink text-paper hover:text-paper")}>{t}</button>;
            })}
          </div>
          <Field label="In your words">{(p) => <Input {...p} {...text("tone")} maxLength={300} placeholder="Direct, practical, a little dry" />}</Field>
        </Section>
        <Section title="Audience">
          <Field label="Who are you writing for?">{(p) => <Input {...p} {...text("audience")} maxLength={300} placeholder="Early-stage founders hiring their first engineers" />}</Field>
        </Section>
        <Section title="Expertise and pillars" hint="The two or three themes you want to be known for. Up to five.">
          <Field label="Expertise">{(p) => <Input {...p} {...text("expertise")} maxLength={500} placeholder="Ten years building B2B onboarding" />}</Field>
          <Field label="Content pillars">{(p) => <TagInput {...p} value={v.pillars} onChange={(pillars) => set({ pillars })} max={5} placeholder="Add a pillar" />}</Field>
        </Section>
        <Section title="Preferred structure">
          <div role="radiogroup" aria-label="Preferred structure" className="grid gap-3 sm:grid-cols-2">
            {STRUCTURES.map(([value, name, desc]) => (
              <button key={name} type="button" role="radio" aria-checked={v.structure === value} onClick={() => set({ structure: value })}
                className={cn("rounded-card border bg-surface p-4 text-left hover:border-ink-3", v.structure === value && "border-2 border-ink")}>
                <span className="block font-medium">{name}</span><span className="mt-1 block text-[13px] text-ink-3">{desc}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Words to avoid" hint="Copilot won't use these words or phrases.">
          <Field label="Words and phrases">{(p) => <TagInput {...p} value={v.avoid} onChange={(avoid) => set({ avoid })} max={20} tone="rose" placeholder="Add a word or phrase" />}</Field>
        </Section>
        <Section title="Example posts" hint="Paste up to five posts you're proud of. Copilot reads them to catch your rhythm.">
          {v.examples.map((e, i) => (
            <div key={i} className="relative">
              <textarea aria-label={`Example post ${i + 1}`} value={e} onChange={(ev) => setExample(i, ev.target.value)} maxLength={3000} rows={5}
                className="w-full resize-y rounded-lg border border-line bg-surface-2 p-3 pr-10 text-[15px] leading-6 focus:bg-surface" />
              <button type="button" aria-label={`Remove example post ${i + 1}`} onClick={() => set({ examples: v.examples.filter((_, j) => j !== i) })} className="absolute right-2 top-2 grid size-7 place-items-center rounded-md text-ink-3 hover:text-ink"><X strokeWidth={1.5} className="size-4" /></button>
            </div>
          ))}
          {v.examples.length < 5 && <Button variant="secondary" onClick={() => set({ examples: [...v.examples, ""] })}><Plus strokeWidth={1.5} />Add an example post</Button>}
        </Section>
      </div>
    </>
  );
}
