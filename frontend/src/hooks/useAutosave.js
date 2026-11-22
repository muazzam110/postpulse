import { useEffect, useRef, useState } from "react";

/**
 * Saves `value` once it has stopped changing for `delay` ms. `null` means "not loaded yet": the first loaded value is the
 * baseline, not an edit. A pending edit is flushed when the component unmounts, and closing the tab mid-save asks first.
 * Returns "idle" | "saving" | "saved" | "error".
 */
export function useAutosave(value, save, delay = 800) {
  const [status, setStatus] = useState("idle");
  const base = useRef();
  const pending = useRef(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (value == null) return;
    if (base.current === undefined) { base.current = value; return; }
    pending.current = { value };
    setStatus("saving");
    const timer = setTimeout(() => {
      pending.current = null;
      saveRef.current(value).then(() => !pending.current && setStatus("saved"), () => setStatus("error"));
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  useEffect(() => () => { if (pending.current) saveRef.current(pending.current.value).catch(() => {}); }, []);

  useEffect(() => {
    if (status !== "saving") return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  return status;
}
