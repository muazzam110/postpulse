import { cn } from "@/lib/utils";

// Text stays ink for contrast; the tone shows in the tint and the icon, so meaning never rests on colour alone.
const TONES = {
  neutral: ["bg-surface-2", "text-ink-3"],
  moss: ["bg-moss-soft", "text-moss"],
  amber: ["bg-amber-soft", "text-amber"],
  sky: ["bg-sky-soft", "text-sky"],
  rose: ["bg-rose-soft", "text-rose"],
};

export function Badge({ tone = "neutral", icon: Icon, className, children }) {
  const [bg, fg] = TONES[tone];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-ink", bg, className)}>
      {Icon && <Icon aria-hidden strokeWidth={1.75} className={cn("size-3.5", fg)} />}
      {children}
    </span>
  );
}
