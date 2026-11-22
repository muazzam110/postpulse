"""Separate worker process: python -m app.worker.main. Claims due jobs from PostgreSQL and runs them."""
import logging
import signal
import sys
import threading

from app.core.config import get_settings
from app.core.security import install_log_redaction
from app.db.session import SessionLocal
from app.services import jobs

log = logging.getLogger("app.worker")


def tick() -> int:
    """One poll: record that the worker is alive, then run every job that is due. Returns how many ran."""
    ran = 0
    with SessionLocal() as db:
        jobs.beat(db)
        while job := jobs.claim(db):
            log.info("job %s (%s) attempt %s: %s", job.id, job.job_type, job.attempts, jobs.execute(db, job))
            ran += 1
    return ran


def run(stop: threading.Event) -> None:
    """Poll until `stop` is set. Used by the standalone worker and by the optional in-API thread."""
    poll = get_settings().worker_poll_seconds
    log.info("worker started (poll every %ss)", poll)
    while not stop.is_set():
        try:
            tick()
        except Exception:  # e.g. the database restarted: keep going, try again next poll
            log.exception("poll failed")
        stop.wait(poll)
    log.info("worker stopped")


def main(argv: list[str] | None = None) -> None:
    """Loop forever, or with --once run a single poll and exit (for a scheduler such as GitHub Actions cron)."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    install_log_redaction()
    if "--once" in (sys.argv[1:] if argv is None else argv):
        log.info("ran %s job(s)", tick())
        return
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    run(stop)


if __name__ == "__main__":
    main()
