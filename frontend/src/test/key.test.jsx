import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getKey, resetKeyState } from "@/api/keyStore";
import { KEY, callsTo, fails, mockApi, renderApp } from "./helpers";

const valid = { "POST /ai/validate-key": { valid: true, free_tier: false } };
const connect = async (key = KEY) => {
  await userEvent.type(await screen.findByLabelText("API key"), key);
  await userEvent.click(screen.getByRole("button", { name: "Connect" }));
};
const stored = () => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]);

describe("OpenRouter key", () => {
  it("validates server-side, then shows only a masked key and the chosen model", async () => {
    const f = mockApi(valid);
    renderApp("/app/settings");
    await connect();
    expect(await screen.findByLabelText("Connected key")).toHaveValue(`${KEY.slice(0, 6)}••••••••${KEY.slice(-4)}`);
    expect(await screen.findByRole("button", { name: "Connected · gpt-6-luna" })).toBeInTheDocument();
    const [url, init] = callsTo(f, "POST", "/ai/validate-key")[0];
    expect(url).toBe("/api/ai/validate-key");
    expect(init.headers["X-OpenRouter-Key"]).toBe(KEY);
    expect(init.body).toBeUndefined(); // the key travels in the header only, never the body or URL
    expect(document.body.innerHTML).not.toContain(KEY);
  });

  it("never writes the key to web storage or cookies", async () => {
    mockApi(valid);
    renderApp("/app/settings");
    await connect();
    await screen.findByLabelText("Connected key");
    expect(stored()).not.toContain(KEY.slice(8));
    expect(localStorage.getItem("gc-key-seen")).toBe("1"); // only the non-secret "a key was connected" hint
  });

  it("keeps the user disconnected when the provider rejects the key", async () => {
    mockApi({ "POST /ai/validate-key": fails(400, "invalid_key", "OpenRouter didn't accept this key. Check it for typos or create a new one.") });
    renderApp("/app/settings");
    await connect();
    expect(await screen.findByRole("alert")).toHaveTextContent("didn't accept this key");
    expect(screen.getByRole("alert")).toHaveClass("text-rose");
    expect(getKey()).toBeNull();
    expect(screen.getByRole("button", { name: "No key" })).toBeInTheDocument();
    expect(localStorage.getItem("gc-key-seen")).toBeNull();
  });

  it("treats a rate limit as retryable, not as a bad key", async () => {
    mockApi({ "POST /ai/validate-key": fails(429, "rate_limited", "OpenRouter is rate-limiting this key. Try again in a moment.") });
    renderApp("/app/settings");
    await connect();
    expect(await screen.findByRole("alert")).toHaveClass("text-amber");
  });

  it("disables Connect until something is typed", async () => {
    mockApi(valid);
    renderApp("/app/settings");
    expect(await screen.findByRole("button", { name: "Connect" })).toBeDisabled();
  });

  it("lets the user pick a model and disconnect, which forgets the key", async () => {
    mockApi(valid);
    renderApp("/app/settings");
    await connect();
    await userEvent.selectOptions(await screen.findByLabelText("Model"), "openai/gpt-6-sol");
    expect(screen.getByRole("button", { name: "Connected · gpt-6-sol" })).toBeInTheDocument();
    expect(localStorage.getItem("gc-model")).toBe("openai/gpt-6-sol");
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(getKey()).toBeNull();
    expect(await screen.findByLabelText("API key")).toHaveValue("");
    expect(screen.getByRole("button", { name: "No key" })).toBeInTheDocument();
  });

  it("replaces a key without ever showing the old one again", async () => {
    mockApi(valid);
    renderApp("/app/settings");
    await connect();
    await userEvent.click(await screen.findByRole("button", { name: "Replace" }));
    const next = "sk-or-v1-" + "z9y8x7w6".repeat(6);
    await userEvent.type(screen.getByLabelText("New key"), next);
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByLabelText("Connected key")).toHaveValue(`${next.slice(0, 6)}••••••••${next.slice(-4)}`);
    expect(getKey()).toBe(next);
  });

  it("asks to reconnect after a refresh, because the key lived only in memory", async () => {
    localStorage.setItem("gc-key-seen", "1");
    resetKeyState(); // what a page reload does: preferences come back, the key does not
    mockApi();
    renderApp("/app/settings");
    expect(await screen.findByRole("button", { name: "Reconnect key" })).toBeInTheDocument();
    expect(screen.getByText(/lives only in this tab's memory/)).toBeInTheDocument();
    expect(getKey()).toBeNull();
  });

  it("states the trust terms next to the form", async () => {
    mockApi();
    renderApp("/app/settings");
    expect(await screen.findByText(/never save it to our database/)).toBeInTheDocument();
    expect(screen.getByText(/You're trusting this app with your credential/)).toBeInTheDocument();
  });
});
