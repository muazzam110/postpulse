import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { KeyStatusPill } from "@/components/brand/KeyStatusPill";
import { mockApi, renderApp } from "./helpers";

const primaryNav = () => screen.findByRole("navigation", { name: "Primary" });

describe("app shell and routing", () => {
  it("redirects / to the studio and renders the landmarks", async () => {
    mockApi();
    renderApp("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Content Studio" })).toBeInTheDocument();
    expect(await primaryNav()).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
  });

  it("exposes every section in the sidebar", async () => {
    mockApi();
    renderApp("/app/studio");
    const nav = await primaryNav();
    for (const name of ["Studio", "Library", "Knowledge", "Planner", "Calendar", "Analytics", "Brand voice", "Settings"]) {
      expect(nav).toHaveTextContent(name);
    }
  });

  it("navigates between pages", async () => {
    mockApi();
    renderApp("/app/studio");
    await userEvent.click((await primaryNav()).querySelector('a[href="/app/library"]'));
    expect(await screen.findByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
  });

  it("shows a recoverable not-found page", async () => {
    mockApi();
    renderApp("/app/does-not-exist");
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Studio" })).toHaveAttribute("href", "/app/studio");
  });

  it("opens the mobile More menu with the remaining sections", async () => {
    mockApi();
    renderApp("/app/studio");
    const more = await screen.findByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    const mobile = screen.getByRole("navigation", { name: "Mobile" });
    expect(mobile).toHaveTextContent("Knowledge");
    expect(mobile).toHaveTextContent("Settings");
  });

  it("starts with no key connected", async () => {
    mockApi();
    renderApp("/app/studio");
    expect(await screen.findByRole("button", { name: "No key" })).toBeInTheDocument();
  });
});

describe("theme", () => {
  it("toggles the dark class and remembers the choice", async () => {
    mockApi();
    renderApp("/app/studio");
    await userEvent.click(await screen.findByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("gc-theme")).toBe("dark");
    await userEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
});

describe("KeyStatusPill", () => {
  it.each([
    [{ status: "connected", model: "gpt-6-sol" }, "Connected · gpt-6-sol"],
    [{ status: "reconnect" }, "Reconnect key"],
    [{ status: "none" }, "No key"],
    [{ status: "bogus" }, "No key"],
  ])("renders %j", (props, label) => {
    render(<KeyStatusPill {...props} />);
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });
});
