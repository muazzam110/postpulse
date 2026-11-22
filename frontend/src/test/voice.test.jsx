import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NO_VOICE, body, callsTo, json, mockApi, renderApp } from "./helpers";

const VOICE = { tone: "Direct", audience: "founders", expertise: "Onboarding", pillars: ["onboarding"], avoid: ["synergy"], structure: "story", examples: ["A post I wrote."] };

describe("brand voice", () => {
  it("loads the saved voice and measures how complete it is", async () => {
    mockApi({ "GET /brand": VOICE });
    renderApp("/app/voice");
    expect(await screen.findByLabelText("Who are you writing for?")).toHaveValue("founders");
    expect(screen.getByText("6/6")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Story/ })).toBeChecked();
    expect(screen.getByText("synergy")).toBeInTheDocument();
  });

  it("starts empty without complaining", async () => {
    mockApi();
    renderApp("/app/voice");
    expect(await screen.findByText("0/6")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not save just from opening the page", async () => {
    const f = mockApi({ "GET /brand": VOICE });
    renderApp("/app/voice");
    await screen.findByText("6/6");
    await new Promise((r) => setTimeout(r, 1100));
    expect(callsTo(f, "PUT", "/brand")).toHaveLength(0);
  });

  it("builds the tone from chips and free text, and autosaves once", async () => {
    const f = mockApi({ "PUT /brand": (init) => json(JSON.parse(init.body)) });
    renderApp("/app/voice");
    await userEvent.click(await screen.findByRole("button", { name: "Direct" }));
    await userEvent.click(screen.getByRole("button", { name: "Warm" }));
    expect(screen.getByLabelText("In your words")).toHaveValue("Direct, Warm");
    await userEvent.click(screen.getByRole("button", { name: "Direct" }));
    expect(screen.getByLabelText("In your words")).toHaveValue("Warm");
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument(), { timeout: 3000 });
    expect(callsTo(f, "PUT", "/brand")).toHaveLength(1);
    expect(body(f, "PUT", "/brand").tone).toBe("Warm");
  });

  it("manages pillars and words to avoid as tags, up to the limit", async () => {
    mockApi();
    renderApp("/app/voice");
    const pillars = await screen.findByLabelText("Content pillars");
    await userEvent.type(pillars, "one{Enter}two,three{Enter}four{Enter}five{Enter}");
    expect(screen.getAllByRole("button", { name: /^Remove (one|two|three|four|five)$/ })).toHaveLength(5);
    expect(pillars).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Remove two" }));
    expect(pillars).toBeEnabled();
    await userEvent.type(screen.getByLabelText("Words and phrases"), "leverage{Enter}");
    expect(screen.getByText("leverage")).toBeInTheDocument();
  });

  it("lets the user add and remove example posts, and never sends a blank one", async () => {
    const f = mockApi({ "PUT /brand": (init) => json(JSON.parse(init.body)) });
    renderApp("/app/voice");
    await userEvent.click(await screen.findByRole("button", { name: "Add an example post" }));
    await userEvent.click(screen.getByRole("button", { name: "Add an example post" }));
    await userEvent.type(screen.getByLabelText("Example post 1"), "My best post");
    await waitFor(() => expect(callsTo(f, "PUT", "/brand")).toHaveLength(1), { timeout: 3000 });
    expect(body(f, "PUT", "/brand").examples).toEqual(["My best post"]);
    await userEvent.click(screen.getByRole("button", { name: "Remove example post 1" }));
    expect(screen.getAllByLabelText(/Example post/)).toHaveLength(1);
  });

  it("stops offering more examples at five", async () => {
    mockApi({ "GET /brand": { ...NO_VOICE, examples: ["a", "b", "c", "d", "e"] } });
    renderApp("/app/voice");
    await screen.findByLabelText("Example post 5");
    expect(screen.queryByRole("button", { name: "Add an example post" })).not.toBeInTheDocument();
  });
});
