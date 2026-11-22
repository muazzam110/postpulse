import os
from pathlib import Path

# Set before the app is imported so tests can never touch the dev database.
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/copilot_test")

import httpx  # noqa: E402
import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.session import engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
from app.services import openrouter  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

if not (make_url(os.environ["DATABASE_URL"]).database or "").endswith("_test"):
    pytest.exit("Refusing to run: the test database name must end in '_test'.", returncode=2)


@pytest.fixture(scope="session")
def alembic_cfg():
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    return cfg


@pytest.fixture(scope="session", autouse=True)
def migrated(alembic_cfg):
    command.upgrade(alembic_cfg, "head")


@pytest.fixture
def app():
    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client(app):
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
def db():
    """Session inside a transaction that is always rolled back."""
    with engine.connect() as conn:
        tx = conn.begin()
        with Session(conn, join_transaction_mode="create_savepoint") as s:
            yield s
        tx.rollback()


@pytest.fixture
def api(client, app, db):
    """Client whose requests run in the rolled-back `db` transaction, so tests never leave users behind."""
    from app.api import auth
    from app.db.session import get_db

    auth._failures.clear()
    app.dependency_overrides[get_db] = lambda: db
    return client


@pytest.fixture
def authed(api):
    api.post("/api/auth/register", json={"email": "k@example.com", "password": "correct horse battery"})
    return api


@pytest.fixture
def provider(monkeypatch):
    """Install a fake OpenRouter; returns the list of requests it received."""
    seen = []

    def install(handler):
        def wrapped(request):
            seen.append(request)
            return handler(request)

        monkeypatch.setattr(openrouter, "TRANSPORT", httpx.MockTransport(wrapped))
        return seen

    return install
