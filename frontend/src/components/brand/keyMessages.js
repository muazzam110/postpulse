import { KEY_IDLE_MINUTES } from "@/api/keyStore";

/** Why there is no key right now, in words. Shared by the app-wide prompt and the Settings form. */
export const whyNoKey = ({ status, idle }) =>
  status !== "reconnect"
    ? "Add your OpenRouter key to start writing. Copilot uses your own account, so you control the cost."
    : idle
      ? `Your key was cleared after ${KEY_IDLE_MINUTES} minutes without activity. Paste it again to keep writing. Your drafts are safe.`
      : "Your key was cleared when this tab was reloaded. Paste it again to keep writing. Your drafts are safe.";
