import { cn } from "@/lib/utils";

/** A single-choice control. `options` is [[value, label], …]. */
export function Segmented({ label, value, onChange, options, className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1", className)}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("h-8 rounded-md px-3 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink", value === v && "bg-surface text-ink shadow-sm")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
