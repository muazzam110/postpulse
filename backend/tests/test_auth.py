import pytest

from app.core import security
from app.models import User

PW = "correct horse battery"


def register(api, email="a@example.com", password=PW):
    return api.post("/api/auth/register", json={"email": email, "password": password})


def login(api, email="a@example.com", password=PW):
    return api.post("/api/auth/login", json={"email": email, "password": password})


def test_register_starts_a_secure_session_and_never_returns_the_hash(api, db):
    r = register(api)
    assert r.status_code == 201 and r.json()["email"] == "a@example.com"
    assert "password" not in r.text
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert api.get("/api/auth/me").json()["email"] == "a@example.com"
    stored = db.query(User).one().password_hash
    assert stored.startswith("$argon2") and PW not in stored


def test_emails_are_case_insensitive_and_unique(api):
    assert register(api, "Mixed@Example.com").json()["email"] == "mixed@example.com"
    dup = register(api, "MIXED@example.com")
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "email_taken"
    assert login(api, "MIXED@EXAMPLE.COM").status_code == 200


def test_short_password_is_rejected_without_echoing_it(api):
    r = register(api, password="short-pw9")
    assert r.status_code == 422 and "short-pw9" not in r.text


def test_wrong_password_and_unknown_email_look_identical(api):
    register(api)
    a, b = login(api, password="wrong-password-1"), login(api, email="nobody@example.com")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json() and a.json()["error"]["code"] == "invalid_credentials"


def test_protected_routes_reject_missing_tampered_and_expired_sessions(api, monkeypatch):
    assert api.get("/api/auth/me").json()["error"]["code"] == "unauthenticated"
    register(api)
    api.cookies.set("session", api.cookies["session"][:-3] + "abc")
    assert api.get("/api/auth/me").status_code == 401
    login(api)
    monkeypatch.setattr(security, "SESSION_SECONDS", -1)
    assert api.get("/api/auth/me").status_code == 401


def test_logout_ends_the_session(api):
    register(api)
    assert api.post("/api/auth/logout").status_code == 204
    assert api.get("/api/auth/me").status_code == 401


def test_each_cookie_resolves_to_its_own_user(api):
    register(api, "a@example.com")
    a_cookie = api.cookies["session"]
    register(api, "b@example.com")
    assert api.get("/api/auth/me").json()["email"] == "b@example.com"
    api.cookies.set("session", a_cookie)
    assert api.get("/api/auth/me").json()["email"] == "a@example.com"


def test_repeated_failures_lock_the_account_temporarily_and_success_resets(api):
    register(api)
    for _ in range(4):
        assert login(api, password="wrong-password-1").status_code == 401
    assert login(api).status_code == 200  # success resets the counter
    for _ in range(5):
        login(api, password="wrong-password-1")
    locked = login(api)  # even the right password is refused while locked
    assert locked.status_code == 429 and locked.json()["error"]["code"] == "too_many_attempts"


@pytest.mark.parametrize("path", ["/api/ai/models", "/api/ai/validate-key"])
def test_ai_routes_require_login(api, path):
    r = api.request("POST" if "validate" in path else "GET", path, headers={"X-OpenRouter-Key": "sk-or-v1-" + "a" * 40})
    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthenticated"
