import { cn } from "@/lib/utils";

const STATES = {
  connected: { dot: "bg-moss", text: "text-ink", label: (m) => (m ? `Connected · ${m}` : "Connected") },
  reconnect: { dot: "bg-amber", text: "text-ink", label: () => "Reconnect key" },
  none: { dot: "bg-ink-3", text: "text-ink-2", label: () => "No key" },
};

/** Always-visible status of the user's OpenRouter key. Phase 2 wires this to the in-memory key. */
export function KeyStatusPill({ status = "none", model, onClick }) {
  const s = STATES[status] ?? STATES.none;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex h-7 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] font-medium", s.text)}
    >
      <span aria-hidden className={cn("size-2 rounded-full", s.dot)} />
      {s.label(model)}
    </button>
  );
}
