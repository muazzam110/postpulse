import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { connectKey, getKey } from "@/api/keyStore";
import { KEY, USER, callsTo, fails, mockApi, renderApp } from "./helpers";

const loggedOut = { "GET /auth/me": fails(401, "unauthenticated", "Please log in to continue.") };
const fill = async (email, password) => {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
};

describe("route protection", () => {
  it("sends visitors without a session to login, then back to the page they wanted", async () => {
    const f = mockApi({ ...loggedOut, "POST /auth/login": () => Response.json(USER) });
    renderApp("/app/library");
    expect(await screen.findByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
    await fill("ada@example.com", "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(JSON.parse(callsTo(f, "POST", "/auth/login")[0][1].body)).toEqual({ email: "ada@example.com", password: "correct horse battery" });
  });

  it("keeps a logged-in user out of the login page", async () => {
    mockApi();
    renderApp("/login");
    expect(await screen.findByRole("heading", { level: 1, name: "Content Studio" })).toBeInTheDocument();
  });
});

describe("login form", () => {
  it("validates on the client before calling the API", async () => {
    const f = mockApi(loggedOut);
    renderApp("/login");
    await userEvent.click(await screen.findByRole("button", { name: "Log in" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(callsTo(f, "POST", "/auth/login")).toHaveLength(0);
  });

  it("shows the server's message for wrong credentials and lets the user retry", async () => {
    mockApi({ ...loggedOut, "POST /auth/login": fails(401, "invalid_credentials", "Email or password is incorrect.") });
    renderApp("/login");
    await screen.findByRole("heading", { name: "Log in" });
    await fill("ada@example.com", "wrong password");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
  });

  it("toggles password visibility", async () => {
    mockApi(loggedOut);
    renderApp("/login");
    const password = await screen.findByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });
});

describe("register form", () => {
  it("enforces the password rule, coaches on strength, then creates the account", async () => {
    const f = mockApi({ ...loggedOut, "POST /auth/register": () => Response.json(USER, { status: 201 }) });
    renderApp("/register");
    await screen.findByRole("heading", { name: "Create your account" });
    await fill("ada@example.com", "short");
    await userEvent.tab();
    expect(screen.getAllByText("Use at least 10 characters.").length).toBeGreaterThan(0);
    expect(screen.getByText("Add a longer phrase")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Password"));
    await userEvent.type(screen.getByLabelText("Password"), "correct horse battery");
    expect(screen.getByText("Good")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Content Studio" })).toBeInTheDocument();
    expect(callsTo(f, "POST", "/auth/register")).toHaveLength(1);
  });

  it("explains a duplicate email", async () => {
    mockApi({ ...loggedOut, "POST /auth/register": fails(409, "email_taken", "An account with this email already exists. Try logging in.") });
    renderApp("/register");
    await screen.findByRole("heading", { name: "Create your account" });
    await fill("ada@example.com", "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  });
});

describe("session lifecycle", () => {
  it("returns to login with a notice, and forgets the key, when the session expires mid-use", async () => {
    connectKey(KEY);
    mockApi({ "GET /brand": fails(401, "unauthenticated", "Please log in to continue.") });
    renderApp("/app/studio");
    expect(await screen.findByText("Your session ended. Log in to continue.")).toBeInTheDocument();
    expect(getKey()).toBeNull();
  });

  it("does not call a failed first check an expiry", async () => {
    mockApi(loggedOut);
    renderApp("/app/studio");
    await screen.findByRole("heading", { name: "Log in" });
    expect(screen.queryByText(/session ended/)).not.toBeInTheDocument();
  });

  it("log out ends the session and drops the key", async () => {
    connectKey(KEY);
    const f = mockApi({ "POST /auth/logout": () => new Response(null, { status: 204 }) });
    renderApp("/app/studio");
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));
    await waitFor(() => expect(getKey()).toBeNull());
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(callsTo(f, "POST", "/auth/logout")).toHaveLength(1);
  });
});
