import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "@/hooks/useAutosave";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = (initial, save = vi.fn().mockResolvedValue()) => ({ save, ...renderHook(({ v }) => useAutosave(v, save, 800), { initialProps: { v: initial } }) });
const settle = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe("useAutosave", () => {
  it("does not save while the value is still loading, nor the first loaded value", async () => {
    const { save, rerender, result } = setup(null);
    rerender({ v: { a: 1 } });
    await settle(2000);
    expect(save).not.toHaveBeenCalled();
    expect(result.current).toBe("idle");
  });

  it("saves once, after the edits stop, with the latest value", async () => {
    const { save, rerender, result } = setup({ a: 0 });
    rerender({ v: { a: 1 } });
    await settle(500);
    rerender({ v: { a: 2 } });
    await settle(500);
    expect(save).not.toHaveBeenCalled();
    expect(result.current).toBe("saving");
    await settle(400);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ a: 2 });
    expect(result.current).toBe("saved");
  });

  it("reports a failed save and recovers on the next edit", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue();
    const { rerender, result } = setup({ a: 0 }, save);
    rerender({ v: { a: 1 } });
    await settle(900);
    expect(result.current).toBe("error");
    rerender({ v: { a: 2 } });
    await settle(900);
    expect(result.current).toBe("saved");
  });

  it("flushes a pending edit when the user leaves the page", async () => {
    const { save, rerender, unmount } = setup({ a: 0 });
    rerender({ v: { a: 1 } });
    await settle(100);
    unmount();
    expect(save).toHaveBeenCalledWith({ a: 1 });
  });

  it("does not save again on unmount when nothing is pending", async () => {
    const { save, rerender, unmount } = setup({ a: 0 });
    rerender({ v: { a: 1 } });
    await settle(900);
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("asks before the tab closes while a save is pending, and only then", async () => {
    const { rerender } = setup({ a: 0 });
    const closing = () => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
    expect(closing()).toBe(false);
    rerender({ v: { a: 1 } });
    expect(closing()).toBe(true);
    await settle(900);
    expect(closing()).toBe(false);
  });
});
