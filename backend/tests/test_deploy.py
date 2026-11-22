import pytest
from fastapi.testclient import TestClient

from app.core import security
from app.core.config import Settings
from app.main import app as fastapi_app


@pytest.fixture
def production(monkeypatch):
    s = Settings(environment="production", session_secret="s" * 48, frontend_origin="https://app.example.com", _env_file=None)
    monkeypatch.setattr(security, "get_settings", lambda: s)
    return s


def test_production_cookies_are_secure_httponly_and_same_site(authed, production):
    authed.post("/api/auth/logout")
    cookie = authed.post("/api/auth/register", json={"email": "prod@example.com", "password": "correct horse battery"}).headers["set-cookie"].lower()
    assert "secure" in cookie and "httponly" in cookie and "samesite=lax" in cookie
    assert "secure" in authed.post("/api/auth/logout").headers["set-cookie"].lower(), "the cookie is cleared with the same attributes"


def test_development_cookies_work_over_plain_http(authed):
    authed.post("/api/auth/logout")
    cookie = authed.post("/api/auth/register", json={"email": "dev@example.com", "password": "correct horse battery"}).headers["set-cookie"].lower()
    assert "secure" not in cookie


def test_only_the_configured_frontend_may_make_credentialed_requests(client):
    ok = client.options("/api/auth/me", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173" and ok.headers.get("access-control-allow-credentials") == "true"
    evil = client.options("/api/auth/me", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in evil.headers
    assert "access-control-allow-origin" not in client.get("/api/health", headers={"Origin": "https://evil.example"}).headers


def test_health_endpoints_need_no_login_and_leak_nothing(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    r = client.get("/api/health/db")
    assert r.status_code == 200 and "postgres" not in r.text.lower().replace("pgvector", "")


@pytest.mark.parametrize("bad", ["", "dev-only-change-me", "short", "x" * 31])
def test_production_refuses_to_start_with_a_weak_secret(bad):
    with pytest.raises(ValueError):
        Settings(environment="production", session_secret=bad, _env_file=None)


def test_no_developer_openrouter_key_is_configurable():
    assert not any("openrouter" in f.lower() or "api_key" in f.lower() for f in Settings.model_fields)


def test_worker_runs_inside_the_api_only_when_asked(monkeypatch):
    import threading

    from app.worker import main as worker

    ran = threading.Event()
    monkeypatch.setattr(worker, "tick", lambda: ran.set() or 0)
    for flag, expected in ((False, False), (True, True)):
        ran.clear()
        monkeypatch.setattr("app.main.get_settings", lambda f=flag: Settings(run_worker_in_api=f, _env_file=None))
        with TestClient(fastapi_app) as c:
            c.get("/api/health")
            assert ran.wait(1) is expected
        assert not any(t.name == "worker" for t in threading.enumerate()), "the thread stops with the API"
