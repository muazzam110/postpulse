import { useEffect, useState } from "react";

const STORAGE_KEY = "gc-theme"; // UI preference only. Never store credentials in web storage.
const DARK_QUERY = "(prefers-color-scheme: dark)";

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "system";
  } catch {
    return "system";
  }
};
const resolve = (theme) => (theme === "system" ? (matchMedia(DARK_QUERY).matches ? "dark" : "light") : theme);

export function useTheme() {
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle("dark", resolve(theme) === "dark");
    apply();
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
    const mq = matchMedia(DARK_QUERY);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return { theme, resolved: resolve(theme), toggle: () => setTheme(resolve(theme) === "dark" ? "light" : "dark") };
}
