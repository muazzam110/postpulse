import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ITEM, USER, body, callsTo, fails, json, mockApi, renderApp } from "./helpers";

const KOLKATA = { ...USER, timezone: "Asia/Kolkata" };
const SCHEDULED = { ...ITEM, status: "scheduled", scheduled_at: "2026-10-30T03:30:00Z" };
const entry = { id: "d1", title: "Hook A", format: "educational", status: "scheduled", scheduled_at: "2026-10-30T03:30:00Z", published_at: null, job: null };

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-23T08:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("approve and schedule from the editor", () => {
  it("approves, then opens the schedule sheet, then shows the time in the user's zone", async () => {
    const f = mockApi({
      "GET /auth/me": KOLKATA, "GET /content/d1": ITEM,
      "PATCH /content/d1": (init) => json({ ...ITEM, status: JSON.parse(init.body).status }),
      "POST /calendar": () => json(entry, 201),
    });
    renderApp("/app/studio/d1");
    await userEvent.click(await screen.findByRole("button", { name: "Approve & schedule" }));
    const dlg = await screen.findByRole("dialog", { name: "Schedule post" });
    expect(body(f, "PATCH", "/content/d1")).toEqual({ status: "approved" });
    fireEvent.change(within(dlg).getByLabelText("Date"), { target: { value: "2026-10-30" } });
    fireEvent.change(within(dlg).getByLabelText("Time"), { target: { value: "09:00" } });
    await userEvent.click(within(dlg).getByRole("button", { name: "Schedule" }));
    expect(await screen.findByText(/Scheduled · Oct 30, 9:00 AM/)).toBeInTheDocument();
    expect(body(f, "POST", "/calendar")).toEqual({ content_id: "d1", scheduled_at: "2026-10-30T03:30:00.000Z" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeInTheDocument();
  });

  it("plain Approve does not open the sheet", async () => {
    mockApi({ "GET /content/d1": ITEM, "PATCH /content/d1": json({ ...ITEM, status: "approved" }) });
    renderApp("/app/studio/d1");
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("button", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open the sheet when approving fails", async () => {
    mockApi({ "GET /content/d1": ITEM, "PATCH /content/d1": fails(500, "server_error", "Something went wrong on our side. Try again.") });
    renderApp("/app/studio/d1");
    await userEvent.click(await screen.findByRole("button", { name: "Approve & schedule" }));
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers Schedule on an approved post and Move back to draft on a scheduled one", async () => {
    mockApi({ "GET /content/d1": { ...ITEM, status: "approved" } });
    const { unmount } = renderApp("/app/studio/d1");
    expect(await screen.findByRole("button", { name: "Schedule" })).toBeInTheDocument();
    unmount();
    mockApi({ "GET /content/d1": SCHEDULED, "PATCH /content/d1": json({ ...ITEM, status: "draft" }) });
    renderApp("/app/studio/d1");
    await userEvent.click(await screen.findByRole("button", { name: "Move back to draft" }));
    await waitFor(() => expect(screen.getByText("Draft")).toBeInTheDocument());
  });

  it("offers no status actions on a published post", async () => {
    mockApi({ "GET /content/d1": { ...ITEM, status: "published", published_at: "2026-10-30T04:00:00Z" } });
    renderApp("/app/studio/d1");
    expect(await screen.findByText("Published")).toBeInTheDocument();
    for (const name of ["Approve", "Reject", "Schedule", "Move back to draft"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });
});

describe("timezone", () => {
  it("is chosen in Settings and saved", async () => {
    const f = mockApi({ "PATCH /auth/me": (init) => json({ ...USER, ...JSON.parse(init.body) }) });
    renderApp("/app/settings");
    await userEvent.click(await screen.findByRole("tab", { name: "Account" }));
    const select = screen.getByLabelText("Timezone");
    expect(select).toHaveValue("UTC");
    await userEvent.selectOptions(select, "Asia/Kolkata");
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(body(f, "PATCH", "/auth/me")).toEqual({ timezone: "Asia/Kolkata" });
    expect(screen.getByLabelText("Timezone")).toHaveValue("Asia/Kolkata");
  });

  it("says why when a zone is refused and keeps the old one", async () => {
    mockApi({ "PATCH /auth/me": fails(422, "validation_error", "That timezone isn't supported.") });
    renderApp("/app/settings");
    await userEvent.click(await screen.findByRole("tab", { name: "Account" }));
    await userEvent.selectOptions(screen.getByLabelText("Timezone"), "Asia/Kolkata");
    expect(await screen.findByText("That timezone isn't supported.")).toBeInTheDocument();
    expect(screen.getByLabelText("Timezone")).toHaveValue("UTC");
  });

  it("is sent from the browser when registering", async () => {
    const f = mockApi({ "GET /auth/me": fails(401, "unauthenticated", "Please log in to continue."), "POST /auth/register": () => json(USER, 201) });
    renderApp("/register");
    await userEvent.type(await screen.findByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password", { exact: true }), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(callsTo(f, "POST", "/auth/register")).toHaveLength(1));
    expect(body(f, "POST", "/auth/register")).toEqual({ email: "ada@example.com", password: "correct horse battery", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  });
});
