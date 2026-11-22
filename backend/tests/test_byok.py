import logging

import httpx
import pytest
from sqlalchemy import text

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import redact
from app.db.session import Base
from app.services import openrouter

KEY = "sk-or-v1-" + "a1b2c3d4" * 6
H = {"X-OpenRouter-Key": KEY}


def ok(_):
    return httpx.Response(200, json={"data": {"label": KEY, "is_free_tier": False}})


def test_valid_key_is_sent_only_to_openrouter_as_a_bearer_token_and_never_echoed(authed, provider):
    seen = provider(ok)
    r = authed.post("/api/ai/validate-key", headers=H)
    assert r.status_code == 200 and r.json() == {"valid": True, "free_tier": False}
    assert KEY not in r.text and KEY not in str(r.headers)
    (req,) = seen
    assert str(req.url) == "https://openrouter.ai/api/v1/auth/key"
    assert req.headers["authorization"] == f"Bearer {KEY}"


def test_key_is_required_and_malformed_keys_never_reach_the_provider(authed, provider):
    seen = provider(ok)
    assert authed.post("/api/ai/validate-key").json()["error"]["code"] == "key_required"
    assert authed.post("/api/ai/validate-key", headers={"X-OpenRouter-Key": "not a key\r\nX-Evil: 1"}).json()["error"]["code"] == "invalid_key"
    assert seen == []


def test_there_is_no_developer_key_fallback(authed, provider, monkeypatch):
    seen = provider(ok)
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-v1-" + "d" * 40)
    assert authed.post("/api/ai/validate-key").status_code == 400 and seen == []
    assert not [f for f in Settings.model_fields if "openrouter" in f or "api_key" in f]


@pytest.mark.parametrize(
    "status,code,http",
    [(401, "invalid_key", 400), (403, "invalid_key", 400), (402, "insufficient_credits", 402), (429, "rate_limited", 429), (500, "provider_error", 502)],
)
def test_provider_failures_become_safe_coded_errors(authed, provider, status, code, http):
    provider(lambda _: httpx.Response(status, text=f"upstream detail {KEY} host=10.0.0.5"))
    r = authed.post("/api/ai/validate-key", headers=H)
    assert (r.status_code, r.json()["error"]["code"]) == (http, code)
    assert KEY not in r.text and "10.0.0.5" not in r.text and "upstream" not in r.text


@pytest.mark.parametrize("exc,code", [(httpx.ReadTimeout("slow"), "timeout"), (httpx.ConnectError("refused"), "provider_unavailable")])
def test_network_failures_are_reported_plainly(authed, provider, exc, code):
    def boom(_):
        raise exc

    provider(boom)
    assert authed.post("/api/ai/validate-key", headers=H).json()["error"]["code"] == code


def test_redirects_are_not_followed_so_the_key_cannot_leak_to_another_host(authed, provider):
    seen = provider(lambda _: httpx.Response(307, headers={"location": "https://evil.example/steal"}))
    r = authed.post("/api/ai/validate-key", headers=H)
    assert r.status_code == 502 and [str(x.url.host) for x in seen] == ["openrouter.ai"]


def test_the_key_never_appears_in_logs_even_when_logged_by_mistake(authed, provider, caplog):
    caplog.set_level(logging.DEBUG)
    provider(lambda _: httpx.Response(401))
    authed.post("/api/ai/validate-key", headers=H)
    logging.getLogger("oops").error("calling with %s and Authorization: Bearer %s", KEY, KEY)
    assert KEY not in caplog.text and "[redacted]" in caplog.text


def test_the_key_is_redacted_from_tracebacks_of_unhandled_errors(app, client, caplog):
    def boom():
        raise RuntimeError(f"provider echoed Authorization: Bearer {KEY}")

    app.add_api_route("/api/_leak", boom)
    try:
        res = client.get("/api/_leak")
    finally:
        app.router.routes.pop()
    assert res.status_code == 500 and KEY not in res.text
    assert "Traceback" in caplog.text, "the traceback must still be logged for debugging"
    assert KEY not in caplog.text


def test_redact_covers_keys_bearer_tokens_and_header_dumps():
    for s in (f"key={KEY}", f"Authorization: Bearer {KEY}", f"x-openrouter-key: {KEY}", f"{{'X-OpenRouter-Key': '{KEY}'}}"):
        assert KEY not in redact(s)


def test_the_key_is_never_persisted(authed, provider, db):
    provider(ok)
    authed.post("/api/ai/validate-key", headers=H)
    for table in Base.metadata.tables:
        assert KEY not in "".join(db.execute(text(f'SELECT t::text FROM "{table}" t')).scalars())


def test_model_list_and_unsupported_model_rejection(authed):
    models = authed.get("/api/ai/models").json()
    assert sum(m["recommended"] for m in models) == 1 and all({"id", "name", "cost"} <= m.keys() for m in models)
    assert openrouter.require_supported(models[0]["id"]) == models[0]["id"]
    with pytest.raises(AppError) as e:
        openrouter.require_supported("evil/not-a-model")
    assert e.value.code == "unsupported_model"
