import { cn } from "@/lib/utils";

/** 1-5 advisory score as a ring. Colour follows value, and the numeral keeps colour from being the only signal. */
export function ScoreRing({ value, label = "Score", size = 64 }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const tone = value >= 4 ? "text-moss" : value >= 3 ? "text-amber" : "text-rose";
  return (
    <span role="img" aria-label={`${label} ${value} out of 5`} className={cn("relative inline-grid shrink-0 place-items-center", tone)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" aria-hidden className="absolute inset-0 -rotate-90 fill-none" strokeWidth="5">
        <circle cx="32" cy="32" r={r} className="stroke-line" />
        <circle cx="32" cy="32" r={r} stroke="currentColor" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 5)} />
      </svg>
      <span aria-hidden className="num relative font-semibold text-ink" style={{ fontSize: size * 0.3 }}>{value}</span>
    </span>
  );
}
