import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DRAFTS, ITEM, KEY, SOURCE, body, callsTo, fails, json, mockApi, renderApp, withKey } from "./helpers";

export const EVAL = {
  scores: { hook: 4, clarity: 4, specificity: 3, voice_fit: 5, cta: 2 }, strengths: ["Specific hook."], improvements: ["Name the metric."],
  average: 3.6, overall: 4, model: "openai/gpt-6-luna", evaluated_at: "2026-10-22T10:00:00Z", similar: [], avoid_hits: [], unsupported_claims: 0,
};
const score = () => userEvent.click(screen.getByRole("button", { name: /Score this draft|Check again/ }));
const editor = (extra = {}) => mockApi({ "GET /content/d1": ITEM, "PATCH /content/d1": ITEM, "POST /ai/evaluate": EVAL, ...extra });

describe("quality check in the editor", () => {
  it("scores the saved draft with the user's key and shows the rubric", async () => {
    withKey();
    const f = editor();
    renderApp("/app/studio/d1");
    await screen.findByLabelText("Hook");
    await score();
    expect(await screen.findByRole("img", { name: "Overall score 4 out of 5" })).toBeInTheDocument();
    for (const [label, n] of [["Hook", 4], ["Clarity", 4], ["Specificity", 3], ["Voice fit", 5], ["Call to action", 2]]) {
      expect(screen.getByText(label, { selector: "span" }).closest("li")).toHaveTextContent(`${n}/5`);
    }
    expect(screen.getByText("Specific hook.")).toBeInTheDocument();
    expect(screen.getByText("Name the metric.")).toBeInTheDocument();
    expect(body(f, "POST", "/ai/evaluate")).toMatchObject({ hook: "Hook A", body: "Body A", content_id: "d1", model: "openai/gpt-6-luna" });
    expect(callsTo(f, "POST", "/ai/evaluate")[0][1].headers["X-OpenRouter-Key"]).toBe(KEY);
    expect(screen.getByText(/advice, not a prediction/)).toBeInTheDocument();
  });

  it("shows a review that was saved with the draft, without calling the model", async () => {
    withKey();
    const f = editor({ "GET /content/d1": { ...ITEM, evaluation: EVAL } });
    renderApp("/app/studio/d1");
    expect(await screen.findByRole("img", { name: "Overall score 4 out of 5" })).toBeInTheDocument();
    expect(callsTo(f, "POST", "/ai/evaluate")).toHaveLength(0);
    expect(screen.queryByText(/edited this since/)).not.toBeInTheDocument();
  });

  it("marks the review out of date when the text changes, and dims rather than hides it", async () => {
    withKey();
    editor({ "GET /content/d1": { ...ITEM, evaluation: EVAL } });
    renderApp("/app/studio/d1");
    await userEvent.type(await screen.findByLabelText("Body"), " More.");
    expect(await screen.findByText(/You've edited this since the last check/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Overall score 4 out of 5" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Body"), "{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}");
    expect(screen.queryByText(/You've edited this since/)).not.toBeInTheDocument(); // back to the reviewed text
  });

  it("says which earlier post it repeats and which avoided words it uses", async () => {
    withKey();
    editor({ "GET /content/d1": { ...ITEM, evaluation: { ...EVAL, similar: [{ id: "old1", title: "Onboarding, take one", similarity: 0.62 }], avoid_hits: ["leverage", "synergy"] } } });
    renderApp("/app/studio/d1");
    const link = await screen.findByRole("link", { name: "Onboarding, take one" });
    expect(link).toHaveAttribute("href", "/app/studio/old1");
    expect(link.closest("p")).toHaveTextContent("62% of its phrases repeat");
    expect(screen.getByText(/avoid list: leverage, synergy/)).toBeInTheDocument();
  });

  it("reports a clean bill when nothing repeats", async () => {
    withKey();
    editor({ "GET /content/d1": { ...ITEM, evaluation: EVAL } });
    renderApp("/app/studio/d1");
    expect(await screen.findByText(/No close repeats of your earlier posts/)).toBeInTheDocument();
  });

  it("shows a safe message when the model's answer was unusable, and keeps the draft", async () => {
    withKey();
    editor({ "POST /ai/evaluate": fails(502, "invalid_output", "The model returned something we couldn't use. Try again, or pick a different model.") });
    renderApp("/app/studio/d1");
    await screen.findByLabelText("Hook");
    await score();
    expect(await screen.findByText(/couldn't use/)).toBeInTheDocument();
    expect(screen.getByLabelText("Hook")).toHaveValue("Hook A");
    expect(screen.getByRole("button", { name: "Score this draft" })).toBeEnabled();
  });

  it("cannot be run without a key, or on an empty draft", async () => {
    const f = editor();
    renderApp("/app/studio/d1");
    await screen.findByLabelText("Hook");
    expect(screen.getByRole("button", { name: "Score this draft" })).toBeDisabled();
    expect(callsTo(f, "POST", "/ai/evaluate")).toHaveLength(0);
  });

  it("is disabled when the hook is empty", async () => {
    withKey();
    editor();
    renderApp("/app/studio/d1");
    await userEvent.clear(await screen.findByLabelText("Hook"));
    expect(screen.getByRole("button", { name: "Score this draft" })).toBeDisabled();
  });
});

describe("quality check and notes in the studio", () => {
  const generated = {
    removed_timestamps: 0,
    drafts: [
      { ...DRAFTS[0], similar: [{ id: "old1", title: "Earlier post", similarity: 0.5 }], avoid_hits: ["leverage"] },
      { ...DRAFTS[1], similar: [], avoid_hits: [] },
      { ...DRAFTS[2], similar: [], avoid_hits: [] },
    ],
    context: [{ id: "c1", title: "Onboarding notes", snippet: "Activation depends on the first five minutes." }, { id: "c2", title: "Onboarding notes", snippet: "second chunk" }, { id: "c3", title: "Pricing", snippet: "x" }],
  };
  const run = async (extra = {}) => {
    withKey();
    const f = mockApi({ "POST /ai/generate": generated, "POST /ai/evaluate": EVAL, ...extra });
    renderApp("/app/studio");
    await userEvent.click(await screen.findByLabelText("Source text"));
    await userEvent.paste(SOURCE);
    await userEvent.click(screen.getByRole("button", { name: "Generate 3 drafts" }));
    await screen.findByRole("tab", { name: "Draft A" });
    return f;
  };

  it("shows which notes were used, once per note", async () => {
    await run();
    expect(screen.getByText(/Drew on your notes/)).toBeInTheDocument();
    expect(screen.getAllByText("Onboarding notes")).toHaveLength(1);
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("Onboarding notes")).toHaveAttribute("title", "Activation depends on the first five minutes.");
  });

  it("shows no note chips when none were used", async () => {
    await run({ "POST /ai/generate": { ...generated, context: [] } });
    expect(screen.queryByText(/Drew on your notes/)).not.toBeInTheDocument();
  });

  it("shows the server's repeat and avoid-word checks per draft, before any model call", async () => {
    const f = await run();
    expect(screen.getByRole("link", { name: "Earlier post" })).toBeInTheDocument();
    expect(screen.getByText(/avoid list: leverage/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Draft B" }));
    expect(screen.queryByRole("link", { name: "Earlier post" })).not.toBeInTheDocument();
    expect(callsTo(f, "POST", "/ai/evaluate")).toHaveLength(0);
  });

  it("keeps each draft's own score when switching tabs and sends the edited text and source", async () => {
    const f = await run();
    await userEvent.click(screen.getByRole("tab", { name: "Draft B" }));
    await score();
    await screen.findByRole("img", { name: "Overall score 4 out of 5" });
    expect(body(f, "POST", "/ai/evaluate")).toMatchObject({ hook: "Hook B", source_text: SOURCE });
    expect(body(f, "POST", "/ai/evaluate").content_id).toBeUndefined();
    await userEvent.click(screen.getByRole("tab", { name: "Draft A" }));
    expect(screen.queryByRole("img", { name: /Overall score/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Draft B" }));
    expect(screen.getByRole("img", { name: "Overall score 4 out of 5" })).toBeInTheDocument();
  });

  it("puts a score that arrives late on the draft it was asked about", async () => {
    let release;
    await run({ "POST /ai/evaluate": () => new Promise((r) => { release = () => r(json(EVAL)); }) });
    await score();
    await userEvent.click(screen.getByRole("tab", { name: "Draft B" }));
    release();
    await userEvent.click(screen.getByRole("tab", { name: "Draft A" }));
    expect(await screen.findByRole("img", { name: "Overall score 4 out of 5" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Draft B" }));
    expect(screen.queryByRole("img", { name: /Overall score/ })).not.toBeInTheDocument();
  });

  it("can leave the knowledge base out, and the saved draft carries no review data", async () => {
    const f = await run();
    await userEvent.click(screen.getByRole("button", { name: "Back to source" }));
    await userEvent.click(screen.getByText("Fine-tune"));
    await userEvent.click(screen.getByLabelText("Draw on my knowledge notes"));
    await userEvent.click(screen.getByRole("button", { name: "Generate 3 drafts" }));
    await screen.findByRole("tab", { name: "Draft A" });
    expect(body(f, "POST", "/ai/generate", 1).use_knowledge).toBe(false);
    expect(body(f, "POST", "/ai/generate", 0).use_knowledge).toBe(true);
  });
});
