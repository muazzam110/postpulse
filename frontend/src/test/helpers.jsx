import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "@/App";
import { connectKey, setModel } from "@/api/keyStore";

export const USER = { id: "u1", email: "ada@example.com", timezone: "UTC" };
export const NO_VOICE = { tone: "", audience: "", expertise: "", pillars: [], avoid: [], structure: "", examples: [] };
export const KEY = "sk-or-v1-" + "a1b2c3d4".repeat(6);
export const MODELS = [
  { id: "openai/gpt-6-luna", name: "GPT-6 Luna", cost: 1, recommended: true },
  { id: "openai/gpt-6-sol", name: "GPT-6 Sol", cost: 3, recommended: false },
];

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
/** A route handler that answers with the backend's error envelope. */
export const fails = (status, code, message) => () => json({ error: { code, message } }, status);

/**
 * Stubs fetch. Routes are keyed "METHOD /path" (no /api prefix); a value is a body (200) or a function(init)
 * returning a Response or Promise. Unlisted routes answer 404. Returns the fetch mock for assertions.
 */
export function mockApi(routes = {}) {
  const table = { "GET /auth/me": USER, "GET /brand": NO_VOICE, "GET /ai/models": MODELS, ...routes };
  const fetchMock = vi.fn((url, init = {}) => {
    let r = table[`${init.method ?? "GET"} ${url.replace(/^\/api/, "")}`];
    if (typeof r === "function") r = r(init);
    if (r === undefined) return Promise.resolve(json({ error: { code: "not_found", message: "Not found." } }, 404));
    return Promise.resolve(r instanceof Response || r instanceof Promise ? r : json(r));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export const renderApp = (path = "/app/studio") => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
export const callsTo = (fetchMock, method, path) => fetchMock.mock.calls.filter(([u, i]) => u === `/api${path}` && (i?.method ?? "GET") === method);

/** A connected key with a chosen model, as if the user had already used Settings. */
export const withKey = () => { connectKey(KEY); setModel(MODELS[0].id); };

export const SOURCE = "We rewrote onboarding three times. The fix was removing the one step nobody finished, and saying so in the first line.";
const draft = (n, extra = {}) => ({ hook: `Hook ${n}`, body: `Body ${n}`, cta: `Question ${n}?`, hashtags: ["#Onboarding"], source_claims: [], ...extra });
export const DRAFTS = [
  draft("A", { source_claims: [{ text: "We rewrote onboarding three times", evidence: "rewrote onboarding three times", supported: true }, { text: "Revenue doubled", evidence: null, supported: false }] }),
  draft("B"),
  draft("C"),
];
export const ITEM = { id: "d1", title: "Hook A", source_type: "idea", format: "educational", ...draft("A"), status: "draft", scheduled_at: null, created_at: "2026-10-20T09:00:00Z", updated_at: "2026-10-21T09:00:00Z", source_text: SOURCE };
export const SUMMARY = {
  removed_timestamps: 0,
  insights: [
    { kind: "claim", text: "Onboarding was rewritten three times", evidence: "rewrote onboarding three times", grounded: true },
    { kind: "lesson", text: "Removing a step beats adding a tour", evidence: null, grounded: false },
    { kind: "claim", text: "Revenue doubled", evidence: "revenue doubled in a quarter", grounded: false },
  ],
  angles: [{ title: "Remove the step", hook: "We deleted one step and activation jumped." }, { title: "Three rewrites", hook: "Three rewrites taught us one thing." }, { title: "Say it first", hook: "Put the fix in line one." }],
};
export const body = (fetchMock, method, path, n = 0) => JSON.parse(callsTo(fetchMock, method, path)[n][1].body);
