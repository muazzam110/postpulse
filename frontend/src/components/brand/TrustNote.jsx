import { ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function TrustNote({ tone = "neutral", className, children }) {
  const Icon = tone === "amber" ? TriangleAlert : ShieldCheck;
  return (
    <p className={cn("flex gap-2.5 rounded-[10px] p-3 text-[13px] leading-5", tone === "amber" ? "bg-amber-soft text-ink" : "bg-surface-2 text-ink-2", className)}>
      <Icon strokeWidth={1.5} className={cn("mt-px size-4 shrink-0", tone === "amber" ? "text-amber" : "text-moss")} />
      <span>{children}</span>
    </p>
  );
}
