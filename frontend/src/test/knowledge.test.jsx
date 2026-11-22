import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { KEY, body, callsTo, fails, mockApi, renderApp, withKey } from "./helpers";

const DOCS = [
  { id: "n1", title: "Onboarding notes", chunks: 2, indexed: true, created_at: "2026-10-20T09:00:00Z" },
  { id: "n2", title: "Pricing lessons", chunks: 1, indexed: false, created_at: "2026-10-19T09:00:00Z" },
];
const NOTE = "Activation depends on the first five minutes of use.";
const fill = async (title = "Onboarding", text = NOTE) => {
  const box = await screen.findByLabelText("Title");
  if (title) await userEvent.type(box, title);
  await userEvent.click(screen.getByLabelText("Note"));
  await userEvent.paste(text);
};
const save = () => userEvent.click(screen.getByRole("button", { name: "Save note" }));

describe("knowledge page", () => {
  it("lists notes with how searchable each is", async () => {
    mockApi({ "GET /knowledge": DOCS });
    renderApp("/app/knowledge");
    const row = (await screen.findByText("Onboarding notes")).closest("li");
    expect(within(row).getByText("Indexed")).toBeInTheDocument();
    expect(within(row).getByText("2 sections")).toBeInTheDocument();
    expect(within(screen.getByText("Pricing lessons").closest("li")).getByText("Keyword only")).toBeInTheDocument();
  });

  it("explains the empty state", async () => {
    mockApi({ "GET /knowledge": [] });
    renderApp("/app/knowledge");
    expect(await screen.findByText("No notes yet")).toBeInTheDocument();
  });

  it("needs a title and enough text before it will save", async () => {
    mockApi({ "GET /knowledge": [] });
    renderApp("/app/knowledge");
    await fill("", "too short");
    expect(screen.getByRole("button", { name: "Save note" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Title"), "A title");
    expect(screen.getByRole("button", { name: "Save note" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Note"), " and now it is long enough");
    expect(screen.getByRole("button", { name: "Save note" })).toBeEnabled();
  });

  it("saves with the key so it can be indexed, then clears the form and refreshes the list", async () => {
    withKey();
    let docs = [];
    const f = mockApi({ "GET /knowledge": () => docs, "POST /knowledge": () => { docs = DOCS.slice(0, 1); return { id: "n1", title: "Onboarding", chunks: 1, indexed: true, warning: null }; } });
    renderApp("/app/knowledge");
    await fill();
    await save();
    expect(await screen.findByText(/Saved and indexed/)).toBeInTheDocument();
    expect(body(f, "POST", "/knowledge")).toEqual({ title: "Onboarding", text: NOTE });
    expect(callsTo(f, "POST", "/knowledge")[0][1].headers["X-OpenRouter-Key"]).toBe(KEY);
    expect(await screen.findByText("Onboarding notes")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("saves without a key too, and says how to make it smarter", async () => {
    const f = mockApi({ "GET /knowledge": [], "POST /knowledge": { id: "n1", title: "x", chunks: 1, indexed: false, warning: null } });
    renderApp("/app/knowledge");
    await fill();
    await save();
    expect(await screen.findByText(/Connect your key to index it/)).toBeInTheDocument();
    expect(callsTo(f, "POST", "/knowledge")[0][1].headers?.["X-OpenRouter-Key"]).toBeUndefined();
  });

  it("keeps the note and explains when indexing failed", async () => {
    withKey();
    mockApi({ "GET /knowledge": [], "POST /knowledge": { id: "n1", title: "x", chunks: 1, indexed: false, warning: "The embedding service returned something we couldn't use." } });
    renderApp("/app/knowledge");
    await fill();
    await save();
    expect(await screen.findByText(/isn't indexed yet: The embedding service/)).toBeInTheDocument();
    expect(screen.getByText(/Keyword search still finds it/)).toBeInTheDocument();
  });

  it("keeps what was typed when saving fails", async () => {
    mockApi({ "GET /knowledge": [], "POST /knowledge": fails(422, "knowledge_full", "Your knowledge base is full. Delete something you no longer need first.") });
    renderApp("/app/knowledge");
    await fill();
    await save();
    expect(await screen.findByRole("alert")).toHaveTextContent("knowledge base is full");
    expect(screen.getByLabelText("Note")).toHaveValue(NOTE);
  });

  it("indexes unindexed notes with the key and reports what is left", async () => {
    withKey();
    const f = mockApi({ "GET /knowledge": DOCS, "POST /knowledge/reindex": { indexed: 1, remaining: 0 } });
    renderApp("/app/knowledge");
    await userEvent.click(await screen.findByRole("button", { name: "Index 1 note" }));
    expect(await screen.findByText("Indexed 1 section.")).toBeInTheDocument();
    expect(callsTo(f, "POST", "/knowledge/reindex")[0][1].headers["X-OpenRouter-Key"]).toBe(KEY);
  });

  it("cannot index without a key", async () => {
    mockApi({ "GET /knowledge": DOCS });
    renderApp("/app/knowledge");
    expect(await screen.findByRole("button", { name: "Index 1 note" })).toBeDisabled();
  });

  it("asks for confirmation before deleting, then removes the note", async () => {
    let docs = DOCS;
    const f = mockApi({ "GET /knowledge": () => docs, "DELETE /knowledge/n1": () => { docs = DOCS.slice(1); return new Response(null, { status: 204 }); } });
    renderApp("/app/knowledge");
    await userEvent.click(await screen.findByRole("button", { name: "Delete Onboarding notes" }));
    expect(callsTo(f, "DELETE", "/knowledge/n1")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(screen.queryByText("Onboarding notes")).not.toBeInTheDocument());
    expect(screen.getByText("Pricing lessons")).toBeInTheDocument();
  });

  it("says so when the list can't be loaded", async () => {
    mockApi({ "GET /knowledge": fails(500, "server_error", "Something went wrong on our side. Try again.") });
    renderApp("/app/knowledge");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});
