"""OpenRouter client. The key is a per-call argument: never stored, never logged, only ever sent to BASE_URL."""
import httpx

from app.core.errors import AppError

BASE_URL = "https://openrouter.ai/api/v1"
TRANSPORT: httpx.BaseTransport | None = None  # tests inject a mock transport

# Curated list; edit here to add or retire models. `cost` is a relative 1-3 hint for the UI.
MODELS = [
    {"id": "openai/gpt-6-luna", "name": "GPT-6 Luna", "note": "Fast and inexpensive. A good default.", "cost": 1, "recommended": True},
    {"id": "anthropic/claude-haiku-5.5", "name": "Claude Haiku 5.5", "note": "Careful, natural prose at low cost.", "cost": 1, "recommended": False},
    {"id": "meta/muse-spark-open", "name": "Muse Spark (open)", "note": "Open-weight, moderate cost.", "cost": 2, "recommended": False},
    {"id": "google/gemini-4-argon", "name": "Gemini 4 Argon", "note": "Long context, higher cost.", "cost": 3, "recommended": False},
    {"id": "anthropic/claude-sonnet-5.5", "name": "Claude Sonnet 5.5", "note": "Strong writing, higher cost.", "cost": 3, "recommended": False},
    {"id": "openai/gpt-6-sol", "name": "GPT-6 Sol", "note": "Strongest of these, highest cost.", "cost": 3, "recommended": False},
]
SUPPORTED = {m["id"] for m in MODELS}


def require_supported(model: str) -> str:
    if model not in SUPPORTED:
        raise AppError(422, "unsupported_model", "That model isn't available. Pick one from the list.")
    return model


def call(key: str, method: str, path: str, *, timeout: float = 20, **kwargs) -> httpx.Response:
    """Single choke point for provider traffic. Provider response bodies are never forwarded to the user."""
    try:
        with httpx.Client(base_url=BASE_URL, transport=TRANSPORT, timeout=timeout, headers={"Authorization": f"Bearer {key}"}) as client:
            res = client.request(method, path, **kwargs)
    except httpx.TimeoutException:
        raise AppError(504, "timeout", "OpenRouter took too long to respond. Your input was kept; try again.")
    except httpx.HTTPError:
        raise AppError(503, "provider_unavailable", "Couldn't reach OpenRouter. Try again shortly.")
    if res.status_code in (401, 403):
        raise AppError(400, "invalid_key", "OpenRouter didn't accept this key. Check it for typos or create a new one.")
    if res.status_code == 402:
        raise AppError(402, "insufficient_credits", "Your OpenRouter account is out of credits.")
    if res.status_code == 429:
        raise AppError(429, "rate_limited", "OpenRouter is rate-limiting this key. Try again in a moment.")
    if not res.is_success:  # includes 3xx: redirects are never followed, so they must not read as success
        raise AppError(502, "provider_error", "OpenRouter couldn't complete the request. Try again.")
    return res


def validate_key(key: str) -> dict:
    res = call(key, "GET", "/auth/key")
    try:
        data = res.json().get("data") or {}
    except ValueError:
        data = {}
    return {"valid": True, "free_tier": bool(data.get("is_free_tier"))}  # the provider's key label can echo the key: not forwarded
