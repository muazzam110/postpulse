import { useId } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-[15px] text-ink placeholder:text-ink-3 transition-colors focus:bg-surface read-only:text-ink-2 aria-[invalid=true]:border-rose",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Label above the control, with a hint or an error wired up via aria-describedby. `children` receives the control's props.
 * `reserve` keeps the message line's height even when empty, so an error appearing on blur can't shift the layout
 * between a click's mouse-down and mouse-up (which would swallow the click).
 */
export function Field({ label, error, hint, reserve, className, children }) {
  const id = useId();
  const note = error || hint;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": note ? `${id}-note` : undefined })}
      {(note || reserve) && <p id={`${id}-note`} className={cn("mt-1.5 text-[13px]", reserve && "min-h-5", error ? "text-rose" : "text-ink-3")}>{note}</p>}
    </div>
  );
}
