import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEY_IDLE_MINUTES, connectKey, disconnectKey, getKey, getKeyState } from "@/api/keyStore";

const MIN = 60_000;
const KEY = "sk-or-v1-" + "a1b2c3d4".repeat(6);
const wait = (minutes) => vi.advanceTimersByTime(minutes * MIN);
// jsdom schedules a zero-delay timer for every localStorage write (the "storage" event): flush those, count the rest.
const longTimers = () => (vi.advanceTimersByTime(0), vi.getTimerCount());

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the key clears itself after inactivity", () => {
  it("keeps the key while the deadline has not passed, then forgets it but remembers one existed", () => {
    connectKey(KEY);
    wait(KEY_IDLE_MINUTES - 1);
    expect(getKey()).toBe(KEY);
    wait(2);
    expect(getKey()).toBeNull();
    expect(getKeyState()).toMatchObject({ idle: true, seen: true }); // the pill will say "Reconnect key"
    expect(localStorage.getItem("gc-key-seen")).toBe("1");
  });

  it.each(["pointerdown", "keydown", "wheel"])("a %s counts as activity and restarts the clock", (type) => {
    connectKey(KEY);
    wait(KEY_IDLE_MINUTES - 10);
    window.dispatchEvent(new Event(type));
    wait(KEY_IDLE_MINUTES - 10); // 40 minutes after connecting, but only 20 since the last activity
    expect(getKey()).toBe(KEY);
    wait(11);
    expect(getKey()).toBeNull();
  });

  it("clears on return if the machine slept past the deadline while timers were suspended", () => {
    connectKey(KEY);
    vi.setSystemTime(Date.now() + 3 * 60 * MIN); // sleep: the clock jumps but no timer fired
    expect(getKey()).toBe(KEY);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(getKey()).toBeNull();
  });

  it("does not clear on a visibility change when the deadline is still ahead", () => {
    connectKey(KEY);
    wait(5);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(getKey()).toBe(KEY);
  });

  it("disconnect stops the clock and the listeners", () => {
    connectKey(KEY);
    disconnectKey();
    expect(longTimers()).toBe(0);
    wait(KEY_IDLE_MINUTES * 2);
    window.dispatchEvent(new Event("keydown"));
    expect(getKey()).toBeNull();
    expect(getKeyState().idle).toBe(false); // an explicit disconnect is not an inactivity clear
  });

  it("connecting again starts a fresh clock and clears the idle notice", () => {
    connectKey(KEY);
    wait(KEY_IDLE_MINUTES + 1);
    connectKey(KEY);
    expect(getKeyState().idle).toBe(false);
    wait(KEY_IDLE_MINUTES - 1);
    expect(getKey()).toBe(KEY);
  });

  it("replacing a key does not stack timers", () => {
    connectKey(KEY);
    connectKey(KEY + "x");
    expect(longTimers()).toBe(1);
  });
});
