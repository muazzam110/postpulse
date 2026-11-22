import { Link } from "react-router-dom";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";

const FORMATS = [["story", "Story"], ["educational", "Educational"], ["lessons", "Lessons"], ["technical", "Technical"], ["framework", "Framework"], ["poll", "Poll"], ["carousel", "Carousel"]];
const LENGTHS = [["short", "Short"], ["medium", "Medium"], ["long", "Long"]];
const CTAS = [["question", "Question"], ["soft", "Soft"], ["direct", "Direct"], ["none", "None"]];

export function SettingsPanel({ cfg, set, voice }) {
  const text = (name) => ({ value: cfg[name], onChange: (e) => set({ [name]: e.target.value }) });
  const writing = [voice?.tone, voice?.audience && `for ${voice.audience}`].filter(Boolean).join(" · ");
  return (
    <aside aria-label="Draft settings" className="space-y-6 lg:sticky lg:top-20 lg:self-start">
      <div className="rounded-card bg-surface-2 p-4 text-[13px] leading-5 text-ink-2">
        {writing ? <>Writing as: <span className="text-ink">{writing}</span>. </> : "No brand voice yet. "}
        <Link to="/app/voice" className="font-medium text-ink underline underline-offset-4">{writing ? "Edit voice" : "Set up your voice"}</Link>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-medium text-ink-2">Format</p>
        <Segmented label="Format" value={cfg.format} onChange={(format) => set({ format })} options={FORMATS} />
      </div>
      <Field label="Goal" hint="Optional. What should this post do?">{(p) => <Input {...p} {...text("goal")} maxLength={200} placeholder="Start conversations with other founders" />}</Field>
      <Field label="Audience">{(p) => <Input {...p} {...text("audience")} maxLength={300} placeholder="Early-stage founders" />}</Field>
      <details className="group rounded-card border bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium">Fine-tune</summary>
        <div className="space-y-5 border-t px-4 py-4">
          <Field label="Tone for this post">{(p) => <Input {...p} {...text("tone")} maxLength={200} placeholder="Direct and a little dry" />}</Field>
          <div><p className="mb-2 text-[13px] font-medium text-ink-2">Length</p><Segmented label="Length" value={cfg.length} onChange={(length) => set({ length })} options={LENGTHS} /></div>
          <div><p className="mb-2 text-[13px] font-medium text-ink-2">Call to action</p><Segmented label="Call to action" value={cfg.cta_style} onChange={(cta_style) => set({ cta_style })} options={CTAS} /></div>
          <label className="flex items-center gap-3"><input type="checkbox" checked={cfg.hashtags} onChange={(e) => set({ hashtags: e.target.checked })} className="size-4 accent-ink" />Include hashtags</label>
          <label className="flex items-center gap-3"><input type="checkbox" checked={cfg.use_knowledge} onChange={(e) => set({ use_knowledge: e.target.checked })} className="size-4 accent-ink" />Draw on my knowledge notes</label>
        </div>
      </details>
    </aside>
  );
}
