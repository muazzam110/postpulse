import contextlib
from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import engine
from app.models import ContentItem, ScheduledJob, User, WorkerHeartbeat
from app.services import jobs
from app.worker import main as worker

KEY = "sk-or-v1-" + "a1b2c3d4" * 6


def make(db, due=-1, status="scheduled", email="w@example.com"):
    """A scheduled post and its job. `due` is minutes from now (negative = already due)."""
    user = db.query(User).filter_by(email=email).one_or_none() or User(email=email, password_hash="x")
    db.add(user)
    db.flush()
    at = jobs.now() + timedelta(minutes=due)
    item = ContentItem(user_id=user.id, title="t", hook="h", body="b", status=status, scheduled_at=at)
    db.add(item)
    db.flush()
    return item, jobs.enqueue(db, item, at)


def test_only_due_queued_jobs_are_claimed_and_the_claim_is_recorded(db):
    _, later = make(db, due=60, email="a@example.com")
    _, due = make(db, email="b@example.com")
    got = jobs.claim(db)
    assert got.id == due.id and got.status == "running" and got.attempts == 1 and got.locked_at
    assert jobs.claim(db) is None and db.get(ScheduledJob, later.id).status == "queued"


def test_the_oldest_due_job_goes_first(db):
    _, newer = make(db, due=-1, email="a@example.com")
    _, older = make(db, due=-30, email="b@example.com")
    assert jobs.claim(db).id == older.id and jobs.claim(db).id == newer.id


def test_two_workers_cannot_claim_the_same_job():
    """Real connections and committed rows: this is what SKIP LOCKED is for."""
    with Session(engine) as setup:
        item, job = make(setup, email="skip@example.com")
        setup.commit()
        job_id, user_id = job.id, item.user_id
    try:
        with Session(engine) as first, Session(engine) as second:
            held = first.execute(select(ScheduledJob).where(ScheduledJob.id == job_id).with_for_update()).scalar_one()  # worker 1 is mid-claim
            assert held.status == "queued"
            assert jobs.claim(second) is None, "worker 2 skips the locked row instead of waiting or double-claiming"
            first.rollback()
            assert jobs.claim(second).id == job_id
    finally:
        with Session(engine) as cleanup:
            cleanup.get(User, user_id) and cleanup.delete(cleanup.get(User, user_id))
            cleanup.commit()


def test_a_job_left_running_by_a_dead_worker_is_recovered_but_a_live_one_is_not(db):
    _, job = make(db)
    first = jobs.claim(db)
    assert jobs.claim(db, jobs.now() + timedelta(seconds=10)) is None, "the lease has not expired"
    again = jobs.claim(db, jobs.now() + timedelta(seconds=301))
    assert again.id == first.id and again.attempts == 2


def test_a_job_that_keeps_killing_its_worker_is_failed_not_retried_forever(db):
    _, job = make(db)
    for n in range(3):
        assert jobs.claim(db, jobs.now() + timedelta(seconds=400 * n)).attempts == n + 1
    assert jobs.claim(db, jobs.now() + timedelta(seconds=2000)) is None
    done = db.get(ScheduledJob, job.id)
    assert done.status == "failed" and "stopped while running" in done.last_error


def test_a_due_reminder_succeeds_and_says_what_it_did(db):
    item, _ = make(db)
    assert jobs.execute(db, jobs.claim(db)) == "succeeded"
    done = db.query(ScheduledJob).filter_by(content_item_id=item.id).one()
    assert done.status == "succeeded" and done.payload == {"outcome": "notified"} and done.locked_at is None and done.last_error is None


def test_a_reminder_for_a_post_that_is_no_longer_scheduled_is_skipped(db):
    item, _ = make(db)
    item.status = "draft"
    db.flush()
    jobs.execute(db, jobs.claim(db))
    assert db.query(ScheduledJob).filter_by(content_item_id=item.id).one().payload == {"outcome": "skipped"}


def test_failures_retry_with_growing_backoff_then_stop_and_never_keep_a_key(db, monkeypatch):
    def boom(_db, _job):
        raise RuntimeError(f"upstream said no for {KEY}")

    monkeypatch.setitem(jobs.HANDLERS, "reminder", boom)
    _, job = make(db)
    waits = []
    for n in (1, 2, 3):
        got = jobs.claim(db, jobs.now() + timedelta(days=n))
        outcome = jobs.execute(db, got)
        db.refresh(job)
        waits.append((job.run_at - jobs.now()).total_seconds())
        assert job.attempts == n
    assert outcome == "failed" and job.status == "failed"
    assert 55 < waits[0] < 65 and 115 < waits[1] < 125, "60s, then 120s"
    assert KEY not in job.last_error and "[redacted]" in job.last_error and len(job.last_error) <= 300
    assert jobs.claim(db, jobs.now() + timedelta(days=9)) is None


def test_an_unknown_job_type_fails_at_once_without_retries(db):
    _, job = make(db)
    job.job_type = "mystery"
    db.flush()
    assert jobs.execute(db, jobs.claim(db)) == "failed"
    assert db.get(ScheduledJob, job.id).attempts == 1


def test_a_worker_presumed_dead_cannot_overwrite_the_new_owner(db):
    _, job = make(db)
    old = jobs.claim(db)
    token = old.attempts
    jobs.claim(db, jobs.now() + timedelta(seconds=400))  # a second worker takes over (attempt 2)
    assert jobs._settle(db, job, token, status="succeeded") is False
    assert db.get(ScheduledJob, job.id).status == "running"


def test_cancelling_while_running_sticks(db):
    item, job = make(db)
    got = jobs.claim(db)
    jobs.cancel_live(db, item.id)
    jobs.execute(db, got)
    assert db.get(ScheduledJob, job.id).status == "cancelled"


def test_a_post_has_at_most_one_live_job(db):
    item, first = make(db)
    second = jobs.enqueue(db, item, jobs.now() + timedelta(hours=1))
    db.refresh(first)
    assert first.status == "cancelled" and second.status == "queued"
    assert db.query(ScheduledJob).filter_by(content_item_id=item.id, status="queued").count() == 1


def test_the_worker_runs_everything_due_and_records_a_heartbeat(db, monkeypatch):
    monkeypatch.setattr(worker, "SessionLocal", lambda: contextlib.nullcontext(db))
    make(db, email="a@example.com")
    make(db, email="b@example.com")
    make(db, due=60, email="c@example.com")
    assert jobs.worker_seen(db) is None
    assert worker.tick() == 2
    assert (jobs.now() - jobs.worker_seen(db)).total_seconds() < 5
    assert worker.tick() == 0 and db.query(WorkerHeartbeat).count() == 1, "one row, updated in place"


def test_once_runs_a_single_poll_and_returns(db, monkeypatch):
    monkeypatch.setattr(worker, "SessionLocal", lambda: contextlib.nullcontext(db))
    make(db, email="once@example.com")
    worker.main(["--once"])  # would loop forever if --once were ignored
    assert db.query(ScheduledJob).filter_by(status="succeeded").count() == 1


def test_the_job_table_has_no_place_for_credentials():
    cols = {c.name for c in ScheduledJob.__table__.columns}
    assert not any(w in c for c in cols for w in ("key", "token", "secret", "password"))
