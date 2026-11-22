from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/copilot"
    frontend_origin: str = "http://localhost:5173"
    session_secret: str = DEV_SECRET
    environment: str = "development"
    embedding_model: str = "openai/text-embedding-3-small"
    embedding_dim: int = 1536
    worker_poll_seconds: float = 5
    worker_max_attempts: int = 3
    worker_lock_timeout_seconds: int = 300
    run_worker_in_api: bool = False  # free hosts have no separate worker: run the same loop in a thread inside the API

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @model_validator(mode="after")
    def _require_real_secret_in_production(self):
        if self.is_production and (self.session_secret == DEV_SECRET or len(self.session_secret) < 32):
            raise ValueError("SESSION_SECRET must be a random string of 32+ characters in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
