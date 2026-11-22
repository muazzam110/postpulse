import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ITEM, body, callsTo, fails, json, mockApi, renderApp } from "./helpers";

const withClaims = { ...ITEM, source_claims: [{ text: "We rewrote onboarding three times", evidence: "rewrote onboarding three times", supported: true }, { text: "Revenue doubled", evidence: null, supported: false }] };

describe("draft editor", () => {
  it("shows the saved draft, its status and the source check", async () => {
    mockApi({ "GET /content/d1": withClaims });
    renderApp("/app/studio/d1");
    expect(await screen.findByLabelText("Hook")).toHaveValue("Hook A");
    expect(screen.getByLabelText("Body")).toHaveValue("Body A");
    expect(screen.getByLabelText("Call to action")).toHaveValue("Question A?");
    expect(screen.getByText("#Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("In your source")).toBeInTheDocument();
    expect(screen.getByText("Needs your check")).toBeInTheDocument();
  });

  it("does not save anything just because it was opened", async () => {
    const f = mockApi({ "GET /content/d1": ITEM });
    renderApp("/app/studio/d1");
    await screen.findByLabelText("Hook");
    await new Promise((r) => setTimeout(r, 1100));
    expect(callsTo(f, "PATCH", "/content/d1")).toHaveLength(0);
  });

  it("autosaves edits in one request and says so", async () => {
    const f = mockApi({ "GET /content/d1": ITEM, "PATCH /content/d1": ITEM });
    renderApp("/app/studio/d1");
    const bodyBox = await screen.findByLabelText("Body");
    await userEvent.type(bodyBox, " More.");
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument(), { timeout: 3000 });
    expect(callsTo(f, "PATCH", "/content/d1")).toHaveLength(1);
    expect(body(f, "PATCH", "/content/d1")).toEqual({ hook: "Hook A", body: "Body A More.", cta: "Question A?", hashtags: ["#Onboarding"] });
  });

  it("keeps the user's edits visible and says so when a save fails", async () => {
    mockApi({ "GET /content/d1": ITEM, "PATCH /content/d1": fails(500, "internal_error", "Something went wrong on our side.") });
    renderApp("/app/studio/d1");
    await userEvent.type(await screen.findByLabelText("Body"), "!");
    expect(await screen.findByText(/Couldn't save/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByLabelText("Body")).toHaveValue("Body A!");
  });

  it("normalises hashtags as they are typed and limits them to five", async () => {
    mockApi({ "GET /content/d1": ITEM });
    renderApp("/app/studio/d1");
    const input = await screen.findByLabelText("Add a hashtag");
    await userEvent.type(input, "ai agents{Enter}#onboarding{Enter}");
    expect(screen.getByText("#aiagents")).toBeInTheDocument();
    expect(screen.getAllByText("#Onboarding")).toHaveLength(1); // duplicate ignored, case-insensitively
    await userEvent.type(input, "a{Enter}b{Enter}c{Enter}d{Enter}e{Enter}");
    expect(input).toBeDisabled();
  });

  it("warns when the hook will fold behind 'see more'", async () => {
    mockApi({ "GET /content/d1": { ...ITEM, hook: "x".repeat(230) } });
    renderApp("/app/studio/d1");
    expect(await screen.findByText(/230 characters · the rest folds behind/)).toBeInTheDocument();
  });

  it("approves, rejects and restores a draft", async () => {
    let status = "draft";
    const f = mockApi({ "GET /content/d1": ITEM, "PATCH /content/d1": (init) => json({ ...ITEM, status: (status = JSON.parse(init.body).status ?? status) }) });
    renderApp("/app/studio/d1");
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Approved")).toBeInTheDocument();
    expect(body(f, "PATCH", "/content/d1")).toEqual({ status: "approved" });
    await userEvent.click(screen.getByRole("button", { name: "Move back to draft" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject draft" }));
    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(body(f, "PATCH", "/content/d1", 2)).toEqual({ status: "rejected" }); // no reason given, none sent
  });

  it("sends the reason for a rejection and lets the user back out", async () => {
    const f = mockApi({ "GET /content/d1": ITEM, "PATCH /content/d1": (init) => json({ ...ITEM, status: JSON.parse(init.body).status }), "GET /content/d1/feedback": [{ action: "rejected", comment: "Too salesy", created_at: "2026-10-21T09:00:00Z" }] });
    renderApp("/app/studio/d1");
    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText(/What was wrong/)).not.toBeInTheDocument();
    expect(callsTo(f, "PATCH", "/content/d1")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await userEvent.type(screen.getByLabelText(/What was wrong/), "Too salesy");
    await userEvent.click(screen.getByRole("button", { name: "Reject draft" }));
    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(body(f, "PATCH", "/content/d1")).toEqual({ status: "rejected", comment: "Too salesy" });
    expect(await screen.findByText(/Too salesy/)).toBeInTheDocument(); // the history
  });

  it("explains a missing draft and links back", async () => {
    mockApi({ "GET /content/nope": fails(404, "not_found", "That draft doesn't exist.") });
    renderApp("/app/studio/nope");
    expect(await screen.findByText("That draft doesn't exist")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Library" })).toHaveAttribute("href", "/app/library");
  });
});

const ROWS = [
  { ...ITEM, id: "a", title: "Onboarding lessons", status: "approved", format: "lessons" },
  { ...ITEM, id: "b", title: "Pricing story", status: "draft", format: "story" },
];

describe("library", () => {
  it("lists drafts with status, format and a link to each", async () => {
    mockApi({ "GET /content": ROWS });
    renderApp("/app/library");
    const row = (await screen.findByText("Onboarding lessons")).closest("li");
    expect(within(row).getByText("Approved")).toBeInTheDocument();
    expect(within(row).getByText(/^lessons · /)).toBeInTheDocument();
    expect(within(row).getByRole("link")).toHaveAttribute("href", "/app/studio/a");
  });

  it("asks the server to filter by status", async () => {
    const f = mockApi({ "GET /content": ROWS, "GET /content?status=approved": [ROWS[0]] });
    renderApp("/app/library");
    await screen.findByText("Pricing story");
    await userEvent.click(screen.getByRole("radio", { name: "Approved" }));
    await waitFor(() => expect(screen.queryByText("Pricing story")).not.toBeInTheDocument());
    expect(callsTo(f, "GET", "/content?status=approved")).toHaveLength(1);
    expect(screen.getByText("Onboarding lessons")).toBeInTheDocument();
  });

  it("invites the user to start when there is nothing", async () => {
    mockApi({ "GET /content": [] });
    renderApp("/app/library");
    expect(await screen.findByText("Nothing drafted yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start from an idea" })).toHaveAttribute("href", "/app/studio");
  });

  it("needs a second click to delete, and removes only that row", async () => {
    const f = mockApi({ "GET /content": ROWS, "DELETE /content/a": () => new Response(null, { status: 204 }) });
    renderApp("/app/library");
    await userEvent.click(await screen.findByRole("button", { name: "Delete Onboarding lessons" }));
    expect(callsTo(f, "DELETE", "/content/a")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(screen.queryByText("Onboarding lessons")).not.toBeInTheDocument());
    expect(screen.getByText("Pricing story")).toBeInTheDocument();
  });

  it("shows a safe error with a retry", async () => {
    let up = false;
    mockApi({ "GET /content": () => (up ? json(ROWS) : Promise.reject(new TypeError("Failed to fetch"))) });
    renderApp("/app/library");
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
    up = true;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Pricing story")).toBeInTheDocument();
  });
});
