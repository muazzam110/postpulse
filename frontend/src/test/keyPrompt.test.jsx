import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KEY_IDLE_MINUTES, resetKeyState } from "@/api/keyStore";
import { fails, mockApi, renderApp, withKey } from "./helpers";

const PROMPT = /Add your OpenRouter key to start writing/;
const loggedOut = { "GET /auth/me": fails(401, "unauthenticated", "Please log in to continue.") };
afterEach(() => vi.useRealTimers());

describe("the key prompt lives inside the app", () => {
  it.each(["/app/studio", "/app/library", "/app/voice"])("asks a signed-in user with no key to add one on %s", async (path) => {
    mockApi();
    renderApp(path);
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add key" })).toHaveAttribute("href", "/app/settings");
  });

  it("is not repeated on Settings, where the key form already is", async () => {
    mockApi();
    renderApp("/app/settings");
    await screen.findByLabelText("API key");
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it("goes away once a key is connected", async () => {
    withKey();
    mockApi();
    renderApp("/app/studio");
    await screen.findByRole("button", { name: /Connected/ });
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it.each(["/login", "/register"])("never puts a key box on %s", async (path) => {
    mockApi(loggedOut);
    renderApp(path);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it("explains a reload: the key lived only in memory", async () => {
    localStorage.setItem("gc-key-seen", "1");
    resetKeyState();
    mockApi();
    renderApp("/app/studio");
    expect(await screen.findByText(/cleared when this tab was reloaded/)).toBeInTheDocument();
  });

  it(`explains inactivity: cleared after ${KEY_IDLE_MINUTES} minutes, in the banner and again on Settings`, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    withKey();
    mockApi();
    renderApp("/app/studio");
    await screen.findByRole("button", { name: /Connected/ });
    act(() => vi.advanceTimersByTime((KEY_IDLE_MINUTES + 1) * 60_000));
    expect(await screen.findByText(/cleared after 30 minutes without activity/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect key" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Add key" }));
    expect(await screen.findByLabelText("API key")).toBeInTheDocument();
    expect(screen.getByText(/cleared after 30 minutes without activity/)).toBeInTheDocument();
  });
});
