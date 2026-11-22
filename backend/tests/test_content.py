from datetime import datetime, timedelta, timezone

import pytest

from app.models import BrandProfile, ContentItem

PW = "correct horse battery"


def make(client, **kw):
    return client.post("/api/content", json={"hook": "We rewrote onboarding.", "body": "The fix was removing one step.", **kw})


def switch_to(client, email):
    """Become another user on the same client (fresh cookie jar, new account)."""
    client.cookies.clear()
    assert client.post("/api/auth/register", json={"email": email, "password": PW}).status_code == 201


# --- drafts: CRUD ---
def test_create_read_edit_delete_roundtrip(authed):
    r = make(authed, hashtags=["#AI Agents", "ai", "#ai"], source_text="raw notes", format="story",
             source_claims=[{"text": "We rewrote it", "evidence": "rewrote onboarding three times"}])
    assert r.status_code == 201
    item = r.json()
    assert item["title"] == "We rewrote onboarding." and item["status"] == "draft" and item["hashtags"] == ["#AIAgents", "#ai"]
    assert item["source_text"] == "raw notes" and item["source_claims"][0]["supported"] is False  # never trusted from the client

    assert authed.get(f"/api/content/{item['id']}").json()["hook"] == item["hook"]
    edited = authed.patch(f"/api/content/{item['id']}", json={"body": "New body.", "status": "approved"}).json()
    assert edited["body"] == "New body." and edited["hook"] == item["hook"] and edited["status"] == "approved"
    assert authed.delete(f"/api/content/{item['id']}").status_code == 204
    assert authed.get(f"/api/content/{item['id']}").status_code == 404


def test_claim_support_is_recomputed_from_the_source_never_taken_from_the_client(authed):
    source = "[00:01] We rewrote onboarding three times. The fix was removing one step."
    claims = [
        {"text": "Real", "evidence": "We rewrote onboarding three times", "supported": False},   # true in the source, despite the flag
        {"text": "Forged", "evidence": "We doubled revenue in a quarter", "supported": True},    # not in the source, despite the flag
        {"text": "No evidence", "evidence": None, "supported": True},
    ]
    saved = make(authed, source_text=source, source_type="transcript", source_claims=claims).json()["source_claims"]
    assert [c["supported"] for c in saved] == [True, False, False]


def test_the_stored_source_is_the_cleaned_text_that_claims_were_checked_against(authed):
    raw = "<p>We rewrote   onboarding</p>\n[3:45] three times.\u200b Activation rose from 31 percent to 47 percent."
    item = make(authed, source_text=raw, source_type="transcript",
                source_claims=[{"text": "Activation rose", "evidence": "Activation rose from 31 percent to 47 percent"}]).json()
    assert item["source_text"] == "We rewrote onboarding\nthree times. Activation rose from 31 percent to 47 percent."
    assert item["source_claims"][0]["supported"] is True


def test_list_omits_the_heavy_source_text_and_filters_by_status(authed, db):
    a = make(authed, title="a", source_text="x" * 50).json()
    b = make(authed, title="b").json()
    authed.patch(f"/api/content/{b['id']}", json={"status": "rejected"})
    now = datetime.now(timezone.utc)
    db.query(ContentItem).filter_by(title="a").update({"updated_at": now - timedelta(days=1)})  # now() is frozen inside one transaction
    listed = authed.get("/api/content").json()
    assert [i["title"] for i in listed] == ["b", "a"] and all("source_text" not in i for i in listed)
    assert [i["id"] for i in authed.get("/api/content?status=rejected").json()] == [b["id"]]
    assert authed.get("/api/content?status=scheduled").json() == [], "scheduled and published are valid filters"
    assert authed.get("/api/content?status=bogus").status_code == 422
    assert a["id"] not in [i["id"] for i in authed.get("/api/content?status=rejected").json()]


@pytest.mark.parametrize("payload", [
    {"format": "essay"}, {"source_type": "tweet"}, {"body": "x" * 3001}, {"hook": "x" * 301}, {"title": "x" * 201},
])
def test_invalid_drafts_are_rejected_without_echoing_input(authed, payload):
    r = make(authed, **payload)
    assert r.status_code == 422 and "x" * 20 not in r.text


def test_only_the_calendar_may_schedule_or_publish(authed):
    item = make(authed).json()
    for status in ("scheduled", "published"):
        assert authed.patch(f"/api/content/{item['id']}", json={"status": status}).status_code == 422


def test_patch_cannot_reassign_ownership_or_set_server_fields(authed, db):
    item = make(authed).json()
    r = authed.patch(f"/api/content/{item['id']}", json={"user_id": "00000000-0000-0000-0000-000000000000", "scheduled_at": "2030-01-01T00:00:00Z", "body": "ok"})
    assert r.status_code == 200 and r.json()["scheduled_at"] is None
    assert str(db.get(ContentItem, item["id"]).user_id) != "00000000-0000-0000-0000-000000000000"


# --- isolation ---
def test_users_cannot_see_change_or_delete_each_others_drafts(api):
    switch_to(api, "a@example.com")
    mine = make(api, title="private").json()
    switch_to(api, "b@example.com")

    assert api.get("/api/content").json() == []
    probes = [api.get(f"/api/content/{mine['id']}"), api.patch(f"/api/content/{mine['id']}", json={"body": "hijacked"}), api.delete(f"/api/content/{mine['id']}")]
    assert {p.status_code for p in probes} == {404}
    missing = api.get("/api/content/00000000-0000-0000-0000-000000000000")
    assert probes[0].json() == missing.json(), "another user's draft must be indistinguishable from a missing one"

    api.cookies.clear()
    assert api.post("/api/auth/login", json={"email": "a@example.com", "password": PW}).status_code == 200
    again = api.get(f"/api/content/{mine['id']}").json()
    assert again["body"] == "The fix was removing one step."


def test_every_draft_and_brand_route_requires_login(api):
    fake = "00000000-0000-0000-0000-000000000000"
    calls = [("get", "/api/content"), ("post", "/api/content"), ("get", f"/api/content/{fake}"), ("patch", f"/api/content/{fake}"),
             ("delete", f"/api/content/{fake}"), ("get", "/api/brand"), ("put", "/api/brand")]
    for method, path in calls:
        r = getattr(api, method)(path, **({} if method in ("get", "delete") else {"json": {}}))
        assert r.status_code == 401 and r.json()["error"]["code"] == "unauthenticated", (method, path)


# --- brand voice ---
def test_brand_voice_defaults_save_update_and_stay_private(api, db):
    switch_to(api, "a@example.com")
    assert api.get("/api/brand").json() == {"tone": "", "audience": "", "expertise": "", "pillars": [], "avoid": [], "structure": "", "examples": []}
    voice = {"tone": "Direct, practical", "audience": "early-stage founders", "expertise": "B2B onboarding", "pillars": ["onboarding", "pricing"],
             "avoid": ["synergy"], "structure": "story", "examples": ["A post I wrote."]}
    assert api.put("/api/brand", json=voice).json() == voice
    assert api.put("/api/brand", json={**voice, "tone": "Warm"}).json()["tone"] == "Warm"
    assert api.get("/api/brand").json()["pillars"] == ["onboarding", "pricing"]
    assert db.query(BrandProfile).count() == 1, "saving twice must update, not duplicate"

    switch_to(api, "b@example.com")
    assert api.get("/api/brand").json()["tone"] == ""


@pytest.mark.parametrize("bad", [
    {"pillars": [f"p{i}" for i in range(6)]}, {"structure": "poem"}, {"avoid": ["x" * 61]}, {"examples": [""]}, {"examples": ["x"] * 6}, {"tone": "x" * 301},
])
def test_brand_voice_limits(authed, bad):
    assert authed.put("/api/brand", json=bad).status_code == 422
