import { describe, expect, it, vi } from "vitest";
import { ApiError, api, setUnauthenticatedHandler } from "@/api/client";
import { connectKey } from "@/api/keyStore";

const reply = (body, status = 200) => vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

describe("api client", () => {
  it("returns parsed JSON and sends credentials", async () => {
    const fetchMock = reply({ status: "ok" });
    vi.stubGlobal("fetch", fetchMock);
    expect(await api("/health")).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.objectContaining({ method: "GET", credentials: "include" }));
  });

  it("sends JSON bodies with a content type", async () => {
    const fetchMock = reply({});
    vi.stubGlobal("fetch", fetchMock);
    await api("/x", { method: "POST", body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("maps the backend error envelope to ApiError, keeping the reference id", async () => {
    vi.stubGlobal("fetch", reply({ error: { code: "internal_error", message: "Something went wrong on our side.", ref: "abc123" } }, 500));
    const err = await api("/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 500, code: "internal_error", ref: "abc123", message: "Something went wrong on our side." });
  });

  it("never surfaces a non-JSON error body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("<html>proxy trace</html>"); } }));
    const err = await api("/x").catch((e) => e);
    expect(err.message).toBe("Something went wrong. Try again.");
  });

  it("turns network failures into a friendly error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = await api("/x").catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: "network" });
    expect(err.message).not.toMatch(/Failed to fetch/);
  });

  it("lets aborts through untouched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));
    await expect(api("/x")).rejects.toMatchObject({ name: "AbortError" });
  });

  it("sends the OpenRouter key in one header, and only when asked", async () => {
    const fetchMock = reply({});
    vi.stubGlobal("fetch", fetchMock);
    await api("/a");
    await api("/b", { key: "sk-or-explicit" });
    connectKey("sk-or-connected");
    await api("/c", { key: true });
    const sent = fetchMock.mock.calls.map(([url, init]) => [url, init.headers?.["X-OpenRouter-Key"]]);
    expect(sent).toEqual([["/api/a", undefined], ["/api/b", "sk-or-explicit"], ["/api/c", "sk-or-connected"]]);
  });

  it("refuses to call out when a key is required but none is connected", async () => {
    const fetchMock = reply({});
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/x", { key: true })).rejects.toMatchObject({ code: "key_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("notifies the app when the session has expired", async () => {
    vi.stubGlobal("fetch", reply({ error: { code: "unauthenticated", message: "Please log in to continue." } }, 401));
    let calls = 0;
    setUnauthenticatedHandler(() => calls++);
    await api("/x").catch(() => {});
    setUnauthenticatedHandler(null);
    expect(calls).toBe(1);
  });
});
