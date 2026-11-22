import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { USER, body, callsTo, fails, json, mockApi, renderApp } from "./helpers";

const NOW = "2026-10-23T08:00:00Z";
const KOLKATA = { ...USER, timezone: "Asia/Kolkata" };
const job = (o = {}) => ({ id: "j1", type: "reminder", status: "queued", attempts: 0, max_attempts: 3, run_at: "2026-10-25T09:00:00Z", last_error: null, updated_at: NOW, ...o });
const entry = (o = {}) => ({ id: "c1", title: "Onboarding lessons", format: "story", status: "scheduled", scheduled_at: "2026-10-25T09:00:00Z", published_at: null, job: job(), ...o });
const seen = (s = 12) => new Date(new Date(NOW).getTime() - s * 1000).toISOString();
const cal = (items = [entry()], worker = seen()) => ({ items, worker_seen_at: worker });
const READY = [{ id: "r1", title: "Pricing post", status: "approved", format: "educational", updated_at: NOW }];
const routes = (c = cal(), extra = {}) => ({ "GET /calendar": c, "GET /content?status=approved": READY, ...extra });

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(NOW)); });
afterEach(() => vi.useRealTimers());

describe("calendar", () => {
  it("puts a post on the day it falls on in the user's timezone", async () => {
    mockApi(routes(cal([entry({ scheduled_at: "2026-10-24T20:00:00Z" })]), { "GET /auth/me": KOLKATA })); // 01:30 on the 25th in Kolkata
    renderApp("/app/calendar");
    const button = await screen.findByRole("button", { name: /Onboarding lessons/ });
    const cell = button.closest("[role=gridcell]");
    expect(within(cell).getByText("25")).toBeInTheDocument();
    expect(button).toHaveTextContent(/1:30/);
  });

  it("shows the same post on the UTC day for a UTC user", async () => {
    mockApi(routes(cal([entry({ scheduled_at: "2026-10-24T20:00:00Z" })])));
    renderApp("/app/calendar");
    expect(within((await screen.findByRole("button", { name: /Onboarding lessons/ })).closest("[role=gridcell]")).getByText("24")).toBeInTheDocument();
  });

  it("says plainly that nothing is posted for the user", async () => {
    mockApi(routes());
    renderApp("/app/calendar");
    expect(await screen.findByText(/never posts to LinkedIn for you/)).toBeInTheDocument();
  });

  it("moves between months and shows a post only in its own month", async () => {
    mockApi(routes(cal([entry({ scheduled_at: "2026-11-03T09:00:00Z" })])));
    renderApp("/app/calendar");
    expect(await screen.findByRole("heading", { name: /October 2026/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Onboarding lessons/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { name: /November 2026/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Onboarding lessons/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("heading", { name: /September 2026/ })).toBeInTheDocument();
  });

  it("lists everything in the list view with a due marker once the reminder has run", async () => {
    mockApi(routes(cal([entry({ job: job({ status: "succeeded", attempts: 1 }) }), entry({ id: "c2", title: "Hiring post", scheduled_at: "2026-12-01T09:00:00Z" })])));
    renderApp("/app/calendar");
    await userEvent.click(await screen.findByRole("radio", { name: "List" }));
    expect(screen.getByText("Due: post it now")).toBeInTheDocument();
    expect(screen.getByText("Hiring post")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });

  it("explains an empty calendar", async () => {
    mockApi(routes(cal([])));
    renderApp("/app/calendar");
    await userEvent.click(await screen.findByRole("radio", { name: "List" }));
    expect(screen.getByText("Nothing scheduled")).toBeInTheDocument();
  });

  it.each([
    [seen(12), /Scheduler last seen 12 s ago/],
    [seen(600), /last seen 10 min ago/],
    [null, /hasn't reported in yet/],
  ])("tells the truth about the worker (%s)", async (worker, text) => {
    mockApi(routes(cal([entry()], worker)));
    renderApp("/app/calendar");
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("offers approved posts for scheduling", async () => {
    mockApi(routes());
    renderApp("/app/calendar");
    expect(await screen.findByText("Pricing post")).toBeInTheDocument();
  });

  it("refreshes quietly every 15 seconds", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(NOW));
    const f = mockApi(routes());
    renderApp("/app/calendar");
    await screen.findByRole("button", { name: /Onboarding lessons/ });
    const before = callsTo(f, "GET", "/calendar").length;
    await vi.advanceTimersByTimeAsync(15000);
    await waitFor(() => expect(callsTo(f, "GET", "/calendar").length).toBe(before + 1));
  });

  it("shows an error with a retry when the calendar can't load", async () => {
    mockApi(routes(undefined, { "GET /calendar": fails(500, "server_error", "Something went wrong on our side. Try again.") }));
    renderApp("/app/calendar");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});

describe("scheduling from the calendar", () => {
  const open = async () => { await userEvent.click(await screen.findByRole("button", { name: "Schedule Pricing post" })); return screen.findByRole("dialog", { name: "Schedule post" }); };
  const pick = (dlg, date, time) => { fireEvent.change(within(dlg).getByLabelText("Date"), { target: { value: date } }); fireEvent.change(within(dlg).getByLabelText("Time"), { target: { value: time } }); };

  it("converts the time typed in the user's zone to UTC", async () => {
    const f = mockApi(routes(cal([]), { "GET /auth/me": KOLKATA, "POST /calendar": () => json(entry({ id: "r1" }), 201) }));
    renderApp("/app/calendar");
    const dlg = await open();
    expect(dlg).toHaveTextContent("Asia/Kolkata · UTC+05:30");
    expect(dlg).toHaveTextContent("Stored in UTC, shown in your timezone");
    pick(dlg, "2026-10-30", "09:00");
    await userEvent.click(within(dlg).getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(callsTo(f, "POST", "/calendar")).toHaveLength(1));
    expect(body(f, "POST", "/calendar")).toEqual({ content_id: "r1", scheduled_at: "2026-10-30T03:30:00.000Z" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("suggests tomorrow at nine in the user's zone", async () => {
    mockApi(routes(cal([]), { "GET /auth/me": KOLKATA }));
    renderApp("/app/calendar");
    const dlg = await open();
    expect(within(dlg).getByLabelText("Date")).toHaveValue("2026-10-24");
    expect(within(dlg).getByLabelText("Time")).toHaveValue("09:00");
  });

  it("refuses a time in the past without calling the server", async () => {
    const f = mockApi(routes(cal([])));
    renderApp("/app/calendar");
    const dlg = await open();
    pick(dlg, "2026-10-22", "09:00");
    await userEvent.click(within(dlg).getByRole("button", { name: "Schedule" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("Pick a time in the future.");
    expect(callsTo(f, "POST", "/calendar")).toHaveLength(0);
  });

  it("keeps the sheet open and says so when the slot is taken", async () => {
    mockApi(routes(cal([]), { "POST /calendar": fails(409, "slot_taken", "This time slot already has a post.") }));
    renderApp("/app/calendar");
    const dlg = await open();
    await userEvent.click(within(dlg).getByRole("button", { name: "Schedule" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("This time slot already has a post.");
    expect(within(dlg).getByRole("button", { name: "Schedule" })).toBeEnabled();
  });

  it("closes with Escape", async () => {
    mockApi(routes(cal([])));
    renderApp("/app/calendar");
    await open();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("a scheduled post's details", () => {
  const openEntry = async () => { await userEvent.click(await screen.findByRole("button", { name: /Onboarding lessons/ })); return screen.findByRole("dialog", { name: "Onboarding lessons" }); };

  it("shows the job: status, attempts and the next run", async () => {
    mockApi(routes());
    renderApp("/app/calendar");
    const dlg = await openEntry();
    expect(within(dlg).getByText("Queued")).toBeInTheDocument();
    expect(dlg).toHaveTextContent("0 of 3");
    expect(within(dlg).getByRole("link", { name: "Open draft" })).toHaveAttribute("href", "/app/studio/c1");
  });

  it("shows a retry in progress and a safe error", async () => {
    mockApi(routes(cal([entry({ job: job({ attempts: 1, last_error: "RuntimeError: db hiccup" }) })])));
    renderApp("/app/calendar");
    const dlg = await openEntry();
    expect(within(dlg).getByText("Retrying (1/3)")).toBeInTheDocument();
    expect(dlg).toHaveTextContent("Last problem: RuntimeError: db hiccup");
  });

  it("shows a failed job and still lets the user reschedule", async () => {
    mockApi(routes(cal([entry({ job: job({ status: "failed", attempts: 3, last_error: "Boom" }) })])));
    renderApp("/app/calendar");
    const dlg = await openEntry();
    expect(within(dlg).getByText("Failed")).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Reschedule" })).toBeEnabled();
  });

  it("tells the user what to do when the reminder is due", async () => {
    mockApi(routes(cal([entry({ job: job({ status: "succeeded", attempts: 1 }) })])));
    renderApp("/app/calendar");
    const dlg = await openEntry();
    expect(dlg).toHaveTextContent("copy it into LinkedIn, then mark it as published");
    expect(within(dlg).getByText("Reminder sent")).toBeInTheDocument();
  });

  it("cancels the schedule and refreshes", async () => {
    let items = [entry()];
    const f = mockApi(routes(undefined, { "GET /calendar": () => cal(items), "DELETE /calendar/c1": () => { items = []; return new Response(null, { status: 204 }); } }));
    renderApp("/app/calendar");
    await userEvent.click(await within(await openEntry()).findByRole("button", { name: "Cancel schedule" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Onboarding lessons/ })).not.toBeInTheDocument());
    expect(callsTo(f, "DELETE", "/calendar/c1")).toHaveLength(1);
  });

  it("marks a post as published", async () => {
    let items = [entry()];
    const f = mockApi(routes(undefined, { "GET /calendar": () => cal(items), "POST /calendar/c1/published": () => { items = [entry({ status: "published", published_at: NOW, job: null })]; return json(items[0]); } }));
    renderApp("/app/calendar");
    await userEvent.click(within(await openEntry()).getByRole("button", { name: "Mark as published" }));
    await waitFor(() => expect(callsTo(f, "POST", "/calendar/c1/published")).toHaveLength(1));
    const dlg = await (async () => { await userEvent.click(await screen.findByRole("button", { name: /Onboarding lessons/ })); return screen.findByRole("dialog"); })();
    expect(within(dlg).getByText("Published")).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Cancel schedule" })).not.toBeInTheDocument();
  });

  it("shows the server's message when cancelling fails", async () => {
    mockApi(routes(undefined, { "DELETE /calendar/c1": fails(404, "not_scheduled", "That post isn't scheduled.") }));
    renderApp("/app/calendar");
    await userEvent.click(within(await openEntry()).getByRole("button", { name: "Cancel schedule" }));
    expect(await screen.findByText("That post isn't scheduled.")).toBeInTheDocument();
  });
});
