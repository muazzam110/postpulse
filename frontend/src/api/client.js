import { getKey } from "@/api/keyStore";

const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(status, code, message, ref) {
    super(message);
    Object.assign(this, { status, code, ref });
  }
}

let onUnauthenticated = null;
/** Called when a request that needed a session gets 401 (session expired mid-use). */
export const setUnauthenticatedHandler = (fn) => { onUnauthenticated = fn; };

/**
 * JSON fetch wrapper. Errors are always ApiError with a user-safe message; raw bodies are never surfaced.
 * `key`: a string sends that OpenRouter key, `true` sends the connected one. It goes in one header, on that call only.
 */
export async function api(path, { method = "GET", body, signal, key } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (key) {
    const value = key === true ? getKey() : key;
    if (!value) throw new ApiError(400, "key_required", "Connect your OpenRouter key to continue.");
    headers["X-OpenRouter-Key"] = value;
  }
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      credentials: "include",
      headers: Object.keys(headers).length ? headers : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError(0, "network", "Can't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    if (err?.code === "unauthenticated") onUnauthenticated?.();
    throw new ApiError(res.status, err?.code ?? "unknown", err?.message ?? "Something went wrong. Try again.", err?.ref);
  }
  return data;
}
