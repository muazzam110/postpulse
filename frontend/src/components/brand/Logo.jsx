export function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center font-display text-lg font-semibold tracking-tight ${className}`}>
      Growth Copilot
      <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-[2px] animate-caret rounded-full bg-ember" />
    </span>
  );
}
