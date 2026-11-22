# LinkedIn Growth Copilot

AI-assisted LinkedIn content workflow. React + JavaScript (Vite, Tailwind) · FastAPI · PostgreSQL + pgvector · OpenRouter (bring your own key) · a separate Python worker. No Redis, no Docker.

Design system and UI rules: [DESIGN.md](./DESIGN.md) · How it fits together: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · Going live (free): [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## How it works

```mermaid
flowchart LR
    U([User]) --> FE
    subgraph Browser
        FE["React app"]
        KS[("OpenRouter key<br/>memory only")]
        FE --- KS
    end
    FE -- "/api/* · session cookie<br/>+ key header on AI calls" --> API
    subgraph Server
        API["FastAPI API"]
        WK["Worker<br/>(reminders)"]
    end
    API <--> DB[("PostgreSQL + pgvector")]
    WK <--> DB
    API -- "user's own key, per call" --> OR["OpenRouter"]
```

The browser talks only to the API. The API checks who you are, applies the rules, and calls OpenRouter with *your* key only when an AI action needs it. A separate worker watches the database for scheduled posts that have come due and turns them into reminders. The database is also the job queue, so there is no Redis or broker. The full walkthrough, with the generation flow, knowledge retrieval, the worker's crash-safe job handling, the data model and the security model, is in **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

## Prerequisites

- Python 3.11+ and Node 20.19+ (22 recommended)
- PostgreSQL 15+ **with the pgvector extension installed** (local install, or a free hosted database that already includes it, such as Neon or Supabase: paste its connection string into `DATABASE_URL`, changing the start from `postgresql://` to `postgresql+psycopg://`)

## 1. Database

```sql
CREATE DATABASE copilot;
CREATE DATABASE copilot_test;   -- used only by the backend tests
```

The first migration runs `CREATE EXTENSION IF NOT EXISTS vector`, so the DB user needs permission to do that (or run it once as a superuser).

## 2. Configure

```bash
cp .env.example .env     # then edit DATABASE_URL (user, password, port)
```

## 3. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload      # http://localhost:8000  (docs at /docs)
```

Worker (separate terminal, same venv): `python -m app.worker.main`

## 4. Frontend

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173 (proxies /api to :8000)
```

## Tests

```bash
cd backend  && pytest              # needs the copilot_test database; set TEST_DATABASE_URL if not default
cd frontend && npm test
```

Backend tests refuse to run against any database whose name does not end in `_test`.

## What it does

Turn a source (post, transcript, notes) into LinkedIn drafts in your voice, check them, plan a week, and get reminded when to post.

- **Studio** (`/app`): clean up a source, extract insights with provenance (real quotes only), generate structured drafts validated server-side, edit with autosave, approve or reject with a reason.
- **Knowledge**: paste notes; they are chunked, embedded (pgvector) and used to ground drafts. Retrieval is always scoped to the signed-in user, with a keyword fallback when embeddings are unavailable.
- **Quality check**: the server flags repetition against your earlier posts and your avoid-words; an optional model review scores five criteria from 1 to 5. The overall number is computed server-side and is advice, not a prediction.
- **Planner and Calendar**: propose a week from a goal, convert cards to drafts, schedule in *your* timezone (stored as UTC). **Scheduling is a reminder, not auto-posting**: a separate worker marks it due, you post it yourself and mark it published.

## Your OpenRouter key

Every user brings their own. The key is asked for inside the app after sign-in (never on the login or sign-up page), held only in browser memory, sent per request in the `X-OpenRouter-Key` header, and never stored or logged by the server. It is forgotten on logout, reload, a 401, or after 30 minutes without activity. There is no developer key anywhere in the config.

Models offered live in `backend/app/services/openrouter.py` (`MODELS`). OpenRouter's catalogue changes; check ids against https://openrouter.ai/models and edit the list when one is retired.

## Configuration

All backend settings come from environment variables or the repo-root `.env` (see `.env.example`).

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | local `copilot` DB | `postgresql+psycopg://user:pass@host:port/db` |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | The only CORS origin allowed |
| `SESSION_SECRET` | dev placeholder | **Required in production, 32+ random characters**; the API refuses to start otherwise |
| `ENVIRONMENT` | `development` | `production` turns on secure cookies and hides `/docs` |
| `EMBEDDING_MODEL` / `EMBEDDING_DIM` | `openai/text-embedding-3-small` / `1536` | Dimension must match the pgvector column |
| `WORKER_POLL_SECONDS` | `5` | Worker polling interval |
| `WORKER_MAX_ATTEMPTS` | `3` | Retries per job (backoff 60s, 120s, ...) |
| `WORKER_LOCK_TIMEOUT_SECONDS` | `300` | A job locked longer than this is reclaimed |
| `RUN_WORKER_IN_API` | `false` | `true` runs the worker loop inside the API (for free hosts with no worker service) |
| `VITE_API_URL` (frontend) | unset | Only if the API is on another origin; dev uses the Vite proxy |

## API overview

All routes are under `/api`; errors use `{"error": {"code", "message"}}`. Interactive docs at `/docs` in development.

- Auth: `POST /auth/register|login|logout`, `GET|PATCH /auth/me`
- AI (key required): `POST /ai/validate-key|summarize|generate|evaluate`, `GET /ai/models`
- Content: `GET|POST /content`, `GET|PATCH|DELETE /content/{id}`, `GET|POST /content/{id}/feedback`; `GET|PUT /brand`
- Knowledge: `GET|POST /knowledge`, `DELETE /knowledge/{id}`, `GET /knowledge/search`, `POST /knowledge/reindex`
- Plans: `GET|POST /plans`, `GET|PATCH|DELETE /plans/{id}`
- Calendar: `GET|POST /calendar`, `DELETE /calendar/{id}`, `POST /calendar/{id}/published`, `GET /jobs/{id}`
- Health: `GET /health`, `GET /health/db`

## Tests and quality evals

```bash
cd backend  && pytest           # 208 tests; needs the copilot_test database
cd frontend && npm test         # 188 tests (Vitest + Testing Library)
cd frontend && npm run build
```

Backend tests refuse to run against a database whose name does not end in `_test`. No test calls the real OpenRouter; the provider is replaced by a scripted transport.

`backend/evals/` holds a small human-reviewed dataset (sources with real and invented quotes, repeat/different pairs, scored posts). The offline detectors run in the test suite. To check a real model against it (costs a few cents, key read from the environment, never printed):

```bash
cd backend && OPENROUTER_KEY=sk-or-... python -m evals.run --model openai/gpt-6-luna
```

## Security model

- Passwords hashed with argon2; sessions are signed httpOnly cookies (`SameSite=Lax`, `Secure` in production); login attempts are throttled.
- Every query is scoped to the signed-in user; user text is passed to models inside fenced "untrusted data" tags and model output is schema-validated (one repair retry).
- Keys and tokens are redacted from logs and error messages. Scheduled jobs hold no credentials.
- Cookies are `Lax`, so the frontend and API must be **same-site** in production (see the deployment guide).

## Windows notes

Use `.venv\Scripts\activate`, and `copy .env.example .env`. Install PostgreSQL with pgvector (e.g. via the EnterpriseDB installer plus the pgvector release for Windows, or use a hosted Postgres such as Neon or Supabase). Run the API, worker and Vite in three terminals.

## Troubleshooting

- `extension "vector" is not available`: pgvector isn't installed for your PostgreSQL version; install it, or use a host that ships it.
- `permission denied to create extension`: run `CREATE EXTENSION vector;` once as a superuser in the `copilot` database.
- `password authentication failed`: fix the user, password and port in `DATABASE_URL`.
- Browser shows login errors or "not signed in" after deploy: frontend and API are not same-site; see the deployment guide.
- Calendar says the worker is quiet: start `python -m app.worker.main`; reminders only fire while it runs.
- Generation fails with "unsupported model": the model list is stale; edit `MODELS` (above).
- Backend tests refuse to start: create `copilot_test` or set `TEST_DATABASE_URL`.

## Known limits (honest)

- Repetition detection is lexical (3-word overlap): it catches reuse, not the same idea in new words.
- The planner has no drag-to-reschedule and drafts cannot be regenerated individually.
- No LinkedIn API integration, no analytics, no auto-posting (by design for the first version).
- Deployment steps are written from the code's requirements and have not been tried on a live host; free-tier limits of any host are unverified.
- Real OpenRouter calls were not exercised in development (no network access to it); behaviour against it is covered by contract-style tests with a scripted provider. Run `python -m evals.run` once with your key to confirm your chosen model.
- Size: about 4,000 lines of application code (1.7k backend, 2.3k frontend) and about 8,000 lines in total with tests, migrations and evals (blank lines included). The application code alone is above the ~3,000-line budget in the technical spec.
