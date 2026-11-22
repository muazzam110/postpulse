import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Type, then Enter / comma / leaving the field to add a tag; Backspace on an empty field removes the last one. */
export function TagInput({ value, onChange, max = 5, maxLength = 60, normalize = (t) => t, tone, placeholder, ...inputProps }) {
  const [text, setText] = useState("");
  const full = value.length >= max;
  const add = () => {
    const tag = normalize(text.trim()).slice(0, maxLength);
    setText("");
    if (tag && tag !== "#" && !full && !value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-2 py-1.5 focus-within:bg-surface">
      {value.map((t) => (
        <span key={t} className={cn("inline-flex h-7 items-center gap-1 rounded-full pl-3 pr-1 text-[13px]", tone === "rose" ? "bg-rose-soft" : "bg-surface border border-line")}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))} className="grid size-5 place-items-center rounded-full text-ink-3 hover:text-ink">
            <X strokeWidth={1.75} className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        {...inputProps}
        value={text}
        disabled={full}
        maxLength={maxLength}
        placeholder={full ? `Up to ${max}` : placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        className="h-7 min-w-24 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
      />
    </div>
  );
}
