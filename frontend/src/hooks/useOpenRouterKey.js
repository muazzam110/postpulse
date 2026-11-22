import { useSyncExternalStore } from "react";
import { api } from "@/api/client";
import { connectKey, disconnectKey, getKeyState, setModel, subscribeKey } from "@/api/keyStore";

let models;
export const loadModels = () => (models ??= api("/ai/models").catch((e) => { models = undefined; throw e; }));

export function useOpenRouterKey() {
  const { key, model, seen, idle } = useSyncExternalStore(subscribeKey, getKeyState);
  return {
    key,
    model,
    idle,
    status: key ? "connected" : seen ? "reconnect" : "none",
    masked: key && `${key.slice(0, 6)}••••••••${key.slice(-4)}`,
    /** Validates server-side first; the key is only kept in memory once the provider accepts it. */
    async connect(candidate) {
      await api("/ai/validate-key", { method: "POST", key: candidate });
      const list = await loadModels().catch(() => []);
      if (!list.some((m) => m.id === getKeyState().model)) setModel(list.find((m) => m.recommended)?.id ?? list[0]?.id ?? null);
      connectKey(candidate);
    },
    disconnect: disconnectKey,
    setModel,
  };
}
