import pytest
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.db.session import get_db

SECRET = "sk-or-v1-supersecret"


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_health_db_reports_pgvector(client):
    body = client.get("/api/health/db").json()
    assert body["status"] == "ok" and body["pgvector"]


def test_unknown_route_uses_error_envelope(client):
    r = client.get("/api/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "http_error"


def test_db_failure_is_sanitized(app, client):
    class Broken:
        def execute(self, *a, **k):
            raise OperationalError("SELECT 1", {}, Exception("password=hunter2 host=10.0.0.5"))

    app.dependency_overrides[get_db] = lambda: Broken()
    r = client.get("/api/health/db")
    assert r.status_code == 503
    assert "hunter2" not in r.text and "10.0.0.5" not in r.text


def test_unhandled_error_hides_details_and_gives_reference(app, client):
    @app.get("/boom")
    def boom():
        raise RuntimeError(SECRET)

    r = client.get("/boom")
    assert r.status_code == 500
    assert SECRET not in r.text and "Traceback" not in r.text
    assert len(r.json()["error"]["ref"]) == 10


def test_validation_error_never_echoes_input(app, client):
    class Body(BaseModel):
        n: int

    @app.post("/echo")
    def echo(b: Body):
        return b

    r = client.post("/echo", json={"n": SECRET})
    assert r.status_code == 422
    assert SECRET not in r.text
    assert r.json()["error"]["fields"][0]["field"] == "n"


def test_cors_allows_only_configured_origin(client):
    ok = client.options("/api/health", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    bad = client.options("/api/health", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-origin" not in bad.headers


def test_production_requires_real_secret():
    with pytest.raises(ValueError):
        Settings(environment="production", _env_file=None)
    assert Settings(environment="production", session_secret="x" * 40, _env_file=None).is_production
