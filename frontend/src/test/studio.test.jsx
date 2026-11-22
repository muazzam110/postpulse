import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DRAFTS, ITEM, KEY, MODELS, NO_VOICE, SOURCE, SUMMARY, body, callsTo, fails, json, mockApi, renderApp, withKey } from "./helpers";

const paste = async (text = SOURCE) => {
  await userEvent.click(await screen.findByLabelText("Source text"));
  await userEvent.paste(text);
};
const generate = () => userEvent.click(screen.getByRole("button", { name: "Generate 3 drafts" }));
const ok = { "POST /ai/generate": { drafts: DRAFTS, removed_timestamps: 0 } };

describe("studio: before generating", () => {
  it("explains that a key is needed and makes no AI call without one", async () => {
    const f = mockApi();
    renderApp("/app/studio");
    expect(await screen.findByText(/Add your OpenRouter key to start writing/)).toBeInTheDocument();
    await paste();
    expect(screen.getByRole("button", { name: "Generate 3 drafts" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Extract insights" })).toBeDisabled();
    expect(callsTo(f, "POST", "/ai/generate")).toHaveLength(0);
  });

  it("asks for enough source text and shows a live count", async () => {
    withKey();
    mockApi();
    renderApp("/app/studio");
    await paste("too short");
    expect(screen.getByRole("button", { name: "Generate 3 drafts" })).toBeDisabled();
    expect(screen.getByText(/at least 20/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Source text"), " but now it is long enough");
    expect(screen.getByRole("button", { name: "Generate 3 drafts" })).toBeEnabled();
  });

  it("pre-fills the audience from the brand voice and says who it is writing as", async () => {
    withKey();
    mockApi({ "GET /brand": { ...NO_VOICE, tone: "Direct, practical", audience: "early-stage founders" } });
    renderApp("/app/studio");
    await waitFor(() => expect(screen.getByLabelText("Audience")).toHaveValue("early-stage founders"));
    expect(screen.getByText(/Direct, practical/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit voice" })).toHaveAttribute("href", "/app/voice");
  });

  it("invites the user to set up a voice when there is none", async () => {
    withKey();
    mockApi();
    renderApp("/app/studio");
    expect(await screen.findByRole("link", { name: "Set up your voice" })).toBeInTheDocument();
  });
});

describe("studio: insights and angles", () => {
  it("separates what the source says from interpretation and unsupported claims", async () => {
    withKey();
    mockApi({ "POST /ai/summarize": { ...SUMMARY, removed_timestamps: 3 } });
    renderApp("/app/studio");
    await paste();
    await userEvent.click(screen.getByRole("button", { name: "Extract insights" }));
    expect(await screen.findByText("In your source")).toBeInTheDocument();
    expect(screen.getByText("Interpretation")).toBeInTheDocument();
    expect(screen.getByText("Needs your check")).toBeInTheDocument();
    expect(screen.getAllByText("Removed 3 timestamps from the transcript.").length).toBeGreaterThan(0);
  });

  it("builds the generation request from the chosen insights and angle", async () => {
    withKey();
    const f = mockApi({ "POST /ai/summarize": SUMMARY, ...ok });
    renderApp("/app/studio");
    await paste();
    await userEvent.click(screen.getByRole("button", { name: "Extract insights" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /Removing a step beats adding a tour/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Remove the step/ }));
    await generate();
    await screen.findByRole("heading", { name: "Your drafts" });
    expect(body(f, "POST", "/ai/generate")).toMatchObject({
      insights: ["Removing a step beats adding a tour"],
      angle: "Remove the step: We deleted one step and activation jumped.",
    });
  });
});

describe("studio: generating, editing, saving", () => {
  it("sends the user's key and settings, then shows three editable variants with a source check", async () => {
    withKey();
    const f = mockApi(ok);
    renderApp("/app/studio");
    await paste();
    await userEvent.click(screen.getByRole("radio", { name: "Story" }));
    await generate();
    expect(await screen.findByRole("heading", { level: 1, name: "Your drafts" })).toBeInTheDocument();

    const [, init] = callsTo(f, "POST", "/ai/generate")[0];
    expect(init.headers["X-OpenRouter-Key"]).toBe(KEY);
    expect(body(f, "POST", "/ai/generate")).toMatchObject({ source_text: SOURCE, source_type: "idea", model: MODELS[0].id, format: "story", length: "medium", cta_style: "question", hashtags: true });

    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Draft A", "Draft B", "Draft C"]);
    expect(screen.getByLabelText("Hook")).toHaveValue("Hook A");
    expect(screen.getByText("In your source")).toBeInTheDocument();
    expect(screen.getByText("Needs your check")).toBeInTheDocument();
    expect(screen.getByText(/Not saved yet/)).toBeInTheDocument();
  });

  it("keeps each variant's edits separate", async () => {
    withKey();
    mockApi(ok);
    renderApp("/app/studio");
    await paste();
    await generate();
    await userEvent.type(await screen.findByLabelText("Hook"), "!");
    await userEvent.click(screen.getByRole("tab", { name: "Draft B" }));
    expect(screen.getByLabelText("Hook")).toHaveValue("Hook B");
    await userEvent.click(screen.getByRole("tab", { name: "Draft A" }));
    expect(screen.getByLabelText("Hook")).toHaveValue("Hook A!");
  });

  it("saves the edited variant with its source, then opens it in the editor", async () => {
    withKey();
    let saved;
    const f = mockApi({
      ...ok,
      "POST /content": (init) => json((saved = { ...ITEM, ...JSON.parse(init.body), id: "d1" }), 201),
      "GET /content/d1": () => json(saved),
    });
    renderApp("/app/studio");
    await paste();
    await generate();
    const hook = await screen.findByLabelText("Hook");
    await userEvent.clear(hook);
    await userEvent.type(hook, "A sharper hook");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await screen.findByRole("button", { name: "Approve" }); // only the saved-draft editor has this
    expect(body(f, "POST", "/content")).toMatchObject({ hook: "A sharper hook", source_text: SOURCE, source_type: "idea", format: "educational" });
    expect(screen.getByLabelText("Hook")).toHaveValue("A sharper hook");
    expect(screen.getByLabelText("Body")).toHaveValue("Body A");
  });

  it("goes back to the source with everything still filled in", async () => {
    withKey();
    mockApi(ok);
    renderApp("/app/studio");
    await paste();
    await generate();
    await userEvent.click(await screen.findByRole("button", { name: /Back to source/ }));
    expect(screen.getByLabelText("Source text")).toHaveValue(SOURCE);
  });

  it("regenerates without losing the page", async () => {
    withKey();
    const f = mockApi(ok);
    renderApp("/app/studio");
    await paste();
    await generate();
    await userEvent.click(await screen.findByRole("button", { name: /Regenerate/ }));
    await waitFor(() => expect(callsTo(f, "POST", "/ai/generate")).toHaveLength(2));
    expect(screen.getByRole("heading", { name: "Your drafts" })).toBeInTheDocument();
  });
});

describe("studio: failures", () => {
  it.each([
    ["invalid_output", 502, "The model returned something we couldn't use. Try again, or pick a different model.", "text-amber"],
    ["rate_limited", 429, "OpenRouter is rate-limiting this key. Try again in a moment.", "text-amber"],
    ["unsupported_model", 422, "That model isn't available. Pick one from the list.", "text-rose"],
  ])("shows a plain message for %s and keeps the user's text", async (code, status, message, tone) => {
    withKey();
    mockApi({ "POST /ai/generate": fails(status, code, message) });
    renderApp("/app/studio");
    await paste();
    await generate();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveClass(tone);
    expect(screen.getByLabelText("Source text")).toHaveValue(SOURCE);
    expect(screen.getByRole("button", { name: "Generate 3 drafts" })).toBeEnabled();
  });

  it("points a rejected key to Settings", async () => {
    withKey();
    mockApi({ "POST /ai/generate": fails(400, "invalid_key", "OpenRouter didn't accept this key. Check it for typos or create a new one.") });
    renderApp("/app/studio");
    await paste();
    await generate();
    expect(await screen.findByRole("link", { name: "Open settings" })).toHaveAttribute("href", "/app/settings");
  });

  it("can be cancelled mid-request without an error", async () => {
    withKey();
    mockApi({ "POST /ai/generate": (init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))) });
    renderApp("/app/studio");
    await paste();
    await generate();
    expect(await screen.findByText(/Drafting three versions/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText(/Drafting three versions/)).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the drafts on screen when saving fails", async () => {
    withKey();
    mockApi({ ...ok, "POST /content": fails(422, "validation_error", "Some fields are invalid.") });
    renderApp("/app/studio");
    await paste();
    await generate();
    await userEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Some fields are invalid.");
    expect(screen.getByLabelText("Hook")).toHaveValue("Hook A");
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
  });
});
