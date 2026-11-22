import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEY, NO_VOICE, body, callsTo, fails, json, mockApi, renderApp, withKey } from "./helpers";

const POSTS = [
  { id: "p1", day: 0, pillar: "Product", format: "story", title: "The step nobody finished", angle: "Why we deleted one step.", time: "09:00" },
  { id: "p2", day: 2, pillar: "Hiring", format: "lessons", title: "What we look for", angle: "Three signals.", time: "10:30" },
  { id: "p3", day: 4, pillar: "Product", format: "educational", title: "Activation, plainly", angle: "Numbers over adjectives.", time: "09:00" },
];
const PLAN = { id: "pl1", title: "Week of Oct 26", week_start: "2026-10-26", goal: "Start conversations with founders", per_week: 3, posts: POSTS, context: ["Onboarding notes"], created_at: "2026-10-23T08:00:00Z" };
const PAST = [{ id: "pl1", title: "Week of Oct 26", week_start: "2026-10-26", goal: "Start conversations with founders", count: 3, created_at: "2026-10-23T08:00:00Z" }];
const day = (name) => screen.getByRole("region", { name });

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-23T08:00:00Z")); });
afterEach(() => vi.useRealTimers());

const plan = async () => {
  await userEvent.type(await screen.findByLabelText("Goal this week"), "Start conversations with founders");
  await userEvent.click(screen.getByRole("button", { name: "Plan my week" }));
  await screen.findByRole("heading", { name: "Week of Oct 26" });
};

describe("planner form", () => {
  it("says plans never publish and starts on the coming Monday", async () => {
    mockApi({ "GET /plans": [] });
    renderApp("/app/planner");
    expect(await screen.findByText("Plans never publish automatically.")).toBeInTheDocument();
    expect(screen.getByLabelText("Week starting")).toHaveValue("2026-10-26");
    expect(await screen.findByText("No plans yet")).toBeInTheDocument();
  });

  it("is disabled without a key, and never calls the model", async () => {
    const f = mockApi({ "GET /plans": [] });
    renderApp("/app/planner");
    await userEvent.type(await screen.findByLabelText("Goal this week"), "Start conversations");
    expect(screen.getByRole("button", { name: "Plan my week" })).toBeDisabled();
    expect(callsTo(f, "POST", "/plans")).toHaveLength(0);
  });

  it("needs a goal and a Monday", async () => {
    withKey();
    mockApi({ "GET /plans": [] });
    renderApp("/app/planner");
    const goal = await screen.findByLabelText("Goal this week");
    expect(screen.getByRole("button", { name: "Plan my week" })).toBeDisabled();
    await userEvent.type(goal, "Start conversations");
    expect(screen.getByRole("button", { name: "Plan my week" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Week starting"), { target: { value: "2026-10-27" } });
    expect(await screen.findByText("Pick a Monday.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan my week" })).toBeDisabled();
  });

  it("starts from the brand voice's pillars and audience", async () => {
    withKey();
    mockApi({ "GET /plans": [], "GET /brand": { ...NO_VOICE, pillars: ["Product lessons"], audience: "founders" } });
    renderApp("/app/planner");
    expect(await screen.findByText("Product lessons")).toBeInTheDocument();
    expect(screen.getByLabelText("Audience")).toHaveValue("founders");
  });

  it("sends the brief with the user's key and shows the plan across the week", async () => {
    withKey();
    const f = mockApi({ "GET /plans": [], "POST /plans": () => json(PLAN, 201) });
    renderApp("/app/planner");
    await plan();
    expect(body(f, "POST", "/plans")).toMatchObject({ goal: "Start conversations with founders", per_week: 3, week_start: "2026-10-26", use_knowledge: true, model: "openai/gpt-6-luna" });
    expect(callsTo(f, "POST", "/plans")[0][1].headers["X-OpenRouter-Key"]).toBe(KEY);
    expect(within(day("Monday")).getByDisplayValue("The step nobody finished")).toBeInTheDocument();
    expect(within(day("Wednesday")).getByDisplayValue("What we look for")).toBeInTheDocument();
    expect(within(day("Friday")).getByDisplayValue("Activation, plainly")).toBeInTheDocument();
    expect(within(day("Tuesday")).getByText("No post")).toBeInTheDocument();
    expect(screen.getByText(/Drew on your notes: Onboarding notes/)).toBeInTheDocument();
  });

  it("can leave the knowledge base out", async () => {
    withKey();
    const f = mockApi({ "GET /plans": [], "POST /plans": () => json(PLAN, 201) });
    renderApp("/app/planner");
    await userEvent.click(await screen.findByLabelText(/Draw on my knowledge notes/));
    await plan();
    expect(body(f, "POST", "/plans").use_knowledge).toBe(false);
  });

  it("shows the server's message and keeps the form when planning fails", async () => {
    withKey();
    mockApi({ "GET /plans": [], "POST /plans": fails(502, "invalid_output", "The model returned something we couldn't use. Try again, or pick a different model.") });
    renderApp("/app/planner");
    await userEvent.type(await screen.findByLabelText("Goal this week"), "Start conversations");
    await userEvent.click(screen.getByRole("button", { name: "Plan my week" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't use");
    expect(screen.getByLabelText("Goal this week")).toHaveValue("Start conversations");
  });
});

describe("plan board", () => {
  const board = async (extra = {}) => {
    withKey();
    const f = mockApi({ "GET /plans": PAST, "GET /plans/pl1": PLAN, "PATCH /plans/pl1": (init) => json({ ...PLAN, ...JSON.parse(init.body) }), ...extra });
    vi.useRealTimers();
    renderApp("/app/planner");
    await userEvent.click(await screen.findByRole("button", { name: /Week of Oct 26/ }));
    await screen.findByRole("heading", { name: "Week of Oct 26", level: 2 });
    return f;
  };

  it("opens a past plan", async () => {
    await board();
    expect(within(day("Monday")).getByDisplayValue("The step nobody finished")).toBeInTheDocument();
  });

  it("saves an edited title once, with the whole week", async () => {
    const f = await board();
    const title = within(day("Wednesday")).getByLabelText("Post title");
    await userEvent.clear(title);
    await userEvent.type(title, "Hiring signals");
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument(), { timeout: 3000 });
    expect(callsTo(f, "PATCH", "/plans/pl1")).toHaveLength(1);
    expect(body(f, "PATCH", "/plans/pl1").posts.map((p) => p.title)).toEqual(["The step nobody finished", "Hiring signals", "Activation, plainly"]);
  });

  it("opens without saving anything", async () => {
    const f = await board();
    await new Promise((r) => setTimeout(r, 1100));
    expect(callsTo(f, "PATCH", "/plans/pl1")).toHaveLength(0);
  });

  it("moves a post to another day by menu (the keyboard route)", async () => {
    const f = await board();
    await userEvent.selectOptions(within(day("Monday")).getByLabelText("Move to day"), "Thursday");
    expect(within(day("Monday")).getByText("No post")).toBeInTheDocument();
    expect(within(day("Thursday")).getByDisplayValue("The step nobody finished")).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, "PATCH", "/plans/pl1")).toHaveLength(1), { timeout: 3000 });
    expect(body(f, "PATCH", "/plans/pl1").posts[0]).toMatchObject({ id: "p1", day: 3 });
  });

  it("changes the suggested time", async () => {
    const f = await board();
    fireEvent.change(within(day("Wednesday")).getByLabelText("Suggested time"), { target: { value: "14:15" } });
    await waitFor(() => expect(callsTo(f, "PATCH", "/plans/pl1")).toHaveLength(1), { timeout: 3000 });
    expect(body(f, "PATCH", "/plans/pl1").posts[1].time).toBe("14:15");
  });

  it("deletes a card", async () => {
    const f = await board();
    await userEvent.click(screen.getByRole("button", { name: "Delete What we look for" }));
    expect(screen.queryByDisplayValue("What we look for")).not.toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, "PATCH", "/plans/pl1")).toHaveLength(1), { timeout: 3000 });
    expect(body(f, "PATCH", "/plans/pl1").posts.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("turns a card into a pre-filled Studio draft", async () => {
    await board();
    await userEvent.click(within(day("Monday")).getByRole("button", { name: "Convert to draft" }));
    const source = await screen.findByLabelText("Source text");
    expect(source).toHaveValue("The step nobody finished\n\nWhy we deleted one step.");
    expect(screen.getByRole("radio", { name: "Story" })).toHaveAttribute("aria-checked", "true");
  });

  it("deletes the plan after confirming", async () => {
    let past = PAST;
    const f = await board({ "GET /plans": () => past, "DELETE /plans/pl1": () => { past = []; return new Response(null, { status: 204 }); } });
    await userEvent.click(screen.getByRole("button", { name: "Delete plan" }));
    expect(callsTo(f, "DELETE", "/plans/pl1")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete plan" }));
    expect(await screen.findByText("No plans yet")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Week of Oct 26", level: 2 })).not.toBeInTheDocument();
  });
});
