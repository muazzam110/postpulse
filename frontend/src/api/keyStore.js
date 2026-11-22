// The OpenRouter key lives in this module variable and nowhere else: never in web storage, cookies, URLs or logs.
// Only non-secret preferences (chosen model, "a key was connected in this browser") are persisted.
// It is forgotten on logout, when the session expires, on reload, and after KEY_IDLE_MINUTES without activity.
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage may be blocked */ } };

export const KEY_IDLE_MINUTES = 30;
const ACTIVITY = ["pointerdown", "keydown", "wheel"];

const fromStorage = () => ({ key: null, model: read("gc-model"), seen: read("gc-key-seen") === "1", idle: false });
let state = fromStorage();
const listeners = new Set();
const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

export const getKeyState = () => state;
export const getKey = () => state.key;
export const subscribeKey = (fn) => (listeners.add(fn), () => listeners.delete(fn));

// Inactivity clock: a deadline that user activity pushes back. A timer checks it, and so does a tab that wakes up,
// because browsers pause timers in background tabs and while a laptop sleeps.
let deadline = 0;
let timer;
const touch = () => { deadline = Date.now() + KEY_IDLE_MINUTES * 60_000; };
function check() {
  if (!state.key) return;
  if (Date.now() >= deadline) { unwatch(); emit({ key: null, idle: true }); return; }
  clearTimeout(timer);
  timer = setTimeout(check, deadline - Date.now() + 50);
}
function watch() {
  unwatch();
  touch();
  ACTIVITY.forEach((e) => window.addEventListener(e, touch, { passive: true }));
  document.addEventListener("visibilitychange", check);
  timer = setTimeout(check, KEY_IDLE_MINUTES * 60_000 + 50);
}
function unwatch() {
  clearTimeout(timer);
  ACTIVITY.forEach((e) => window.removeEventListener(e, touch));
  document.removeEventListener("visibilitychange", check);
}

export function connectKey(key) {
  write("gc-key-seen", "1");
  watch();
  emit({ key, seen: true, idle: false });
}
export function disconnectKey() {
  unwatch();
  write("gc-key-seen", null);
  emit({ key: null, seen: false, idle: false });
}
export function setModel(model) {
  write("gc-model", model);
  emit({ model });
}
/** What a page refresh does: the key is gone, only the non-secret preferences come back. */
export const resetKeyState = () => { unwatch(); emit(fromStorage()); };
