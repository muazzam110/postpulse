import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, auth, brand, calendar, content, health, knowledge, plans
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.security import install_log_redaction

settings = get_settings()
docs = None if settings.is_production else "/docs"

@asynccontextmanager
async def lifespan(_):
    """Optionally run the reminder worker inside this process (RUN_WORKER_IN_API=true), for hosts with no worker service."""
    stop = threading.Event()
    thread = None
    if get_settings().run_worker_in_api:
        from app.worker.main import run

        thread = threading.Thread(target=run, args=(stop,), name="worker", daemon=True)
        thread.start()
    yield
    stop.set()
    if thread:
        thread.join(timeout=10)


app = FastAPI(title="LinkedIn Growth Copilot", lifespan=lifespan, docs_url=docs, redoc_url=None, openapi_url=None if docs is None else "/openapi.json")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
install_log_redaction()
install_error_handlers(app)
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(brand.router, prefix="/api")
app.include_router(content.router, prefix="/api")
app.include_router(knowledge.router, prefix="/api")
app.include_router(plans.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(calendar.job_router, prefix="/api")
