<div align="center">

# LinkedIn Growth Copilot

**Turn what you already know into LinkedIn posts that sound like you, backed by evidence, with a weekly plan and a reminder to post.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white)
![Status](https://img.shields.io/badge/status-beta-orange)

<!-- Add after you deploy: **[Live demo](https://YOUR-APP.vercel.app)** · -->
[Architecture](./docs/ARCHITECTURE.md) · [Deployment guide](./docs/DEPLOYMENT.md)

</div>

<!--
Add screenshots after you take them (a Studio screen, the Calendar, the quality check):
<p align="center"><img src="docs/screenshots/studio.png" width="820" alt="Studio: from source text to drafts"></p>
-->

## The problem

Most people who want to build an audience on LinkedIn already have the raw material: call notes, transcripts, lessons from client work. Turning that into consistent posts is the slow part. Generic AI writing tools can invent details, repeat themselves, and sound like everyone else.

Copilot is built around those three problems. Every draft is grounded in text you supplied, checked by code rather than by the model, and shaped by your own voice settings and notes.

## What it does

| Area | What you get |
|---|---|
| **Studio** | Paste a post, transcript or notes. Clean it up, extract insights with a supporting quote for each, and generate structured drafts (hook, body, call to action, hashtags). Edit with autosave, then approve or reject with a reason. |
| **Voice** | Set tone, audience, expertise, preferred structure, words to avoid and example posts. These steer every generation. |
| **Knowledge base** | Paste your own notes. They are chunked, embedded and used to ground drafts. Retrieval is always scoped to the signed-in user and falls back to keyword search when embeddings are unavailable. |
| **Quality check** | Code flags repetition against your earlier posts and your avoid-words. An optional model review scores five criteria from 1 to 5, and the server computes the overall number. It is advice, not a prediction. |
| **Library and Editor** | Every draft is saved, filterable by status, and editable. |
| **Planner** | Propose a week of posts from a goal, then turn cards into drafts. |
| **Calendar and reminders** | Schedule in your own timezone. A separate worker marks a post as due and you post it yourself. |

## Design principles

- **Bring your own key.** Each user supplies their own OpenRouter key. It lives only in browser memory and is sent per request. The server never stores or logs it, and there is no developer key anywhere.
- **Reminder, not auto-posting.** The app never touches LinkedIn credentials. It tells you when a post is due and you publish it yourself.
- **Evidence over confidence.** Each insight carries a quote, and the server checks that the quote really occurs in your source. The model is never asked to grade its own work.
- **Untrusted by default.** User text and model output are both treated as untrusted data and validated before use.

## Architecture

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

The browser talks only to the API. The API checks who you are, applies the rules, and calls OpenRouter with your key only when an AI action needs it. A separate worker watches the database for scheduled posts that have come due. The database is also the job queue, so there is no Redis or message broker. The full walkthrough is in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

### How a draft is made

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Browser
    participant API as FastAPI
    participant DB as PostgreSQL
    participant OR as OpenRouter

    U->>FE: Pastes source, clicks Generate
    FE->>API: POST /ai/generate (cookie + X-OpenRouter-Key)
    API->>API: Check session, check key shape
    API->>API: Clean the source (strip tags, timestamps)
    API->>DB: Load brand voice and past rejection reasons
    API->>OR: Embed the query (user's key)
    API->>DB: Nearest notes for this user (pgvector) + keyword top-up
    API->>OR: Chat request in JSON mode (voice, brief, notes, source)
    OR-->>API: JSON with 3 drafts
    API->>API: Validate with Pydantic (one repair retry if invalid)
    API->>API: Check each quoted claim really occurs in the source
    API->>DB: Compare with the user's earlier posts and avoid-words
    API-->>FE: Drafts + which notes were used + quality flags
    U->>FE: Edits, approves
    FE->>API: PATCH /content/{id} (autosave)
```

## Engineering highlights

| Problem | Approach | Where |
|---|---|---|
| Reminders must survive crashes and restarts | A job queue in PostgreSQL. Workers claim jobs atomically with `FOR UPDATE SKIP LOCKED`, hold a lease, retry with exponential backoff (3 attempts), and use the attempt number as a fencing token so a stale worker cannot overwrite a newer result. A partial unique index allows only one live job per post. | `backend/app/services/jobs.py`, migration `0004` |
| Model output can be malformed | One shared `chat_json` helper: JSON mode, Pydantic validation, and a single repair retry that sends back only the names of the failing fields, never the values. One bad draft out of three is dropped and the rest are kept. | `backend/app/services/` |
| Models invent facts | Every insight carries a supporting quote. The server checks the quote against the source text (ignoring case and punctuation) and shows the result as supported or not. | `backend/app/services/source.py` |
| Prompt injection | User text is wrapped in fenced tags and the system prompt says content inside them is data. Text that looks like the app's own tags is stripped first so it cannot close a fence early. | `backend/app/services/generate.py` |
| Semantic search can fail | pgvector cosine search in the same database, filtered by `user_id`, with a PostgreSQL full-text (GIN) fallback when embeddings are unavailable. | `backend/app/services/knowledge.py`, migration `0003` |
| Scores from a model are not evidence | Repeat detection and avoid-word matching are pure code. The overall review score is computed on the server from validated sub-scores, and any total the model sends is ignored. | `backend/app/services/evaluate.py` |
| Time zones | Times are stored in UTC, converted in the browser, and the server rejects a time that has no timezone. | `frontend/src/lib/tz.js` |
| Is the prompt or model getting better? | A fixed, human-labelled dataset and a runner that checks the deterministic detectors with no key or cost, and can optionally compare model scores with human scores. | `backend/evals/` |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, JavaScript, Vite, Tailwind CSS, React Router 7, hand-written shadcn-style components |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, Alembic, psycopg 3 |
| Database | PostgreSQL 15+ with the pgvector extension |
| Auth | Server-side sessions: argon2 password hashes, signed `HttpOnly` cookie (`itsdangerous`) |
| AI | OpenRouter, using each user's own key. Several selectable models plus an embedding model |
| Worker | A separate Python process using PostgreSQL as its queue |
| Tests | pytest and Vitest |

## Security and privacy

- Passwords are hashed with argon2, with a dummy hash so login timing does not reveal which emails exist.
- The session cookie is `HttpOnly` and `SameSite=Lax`, and `Secure` in production. In production the API refuses to start with a weak `SESSION_SECRET`.
- CORS allows only the configured frontend origin. The interactive API docs are hidden in production.
- Every query is scoped by `user_id`, and another user's records return 404.
- Keys and bearer tokens are redacted from logs. The OpenRouter key is never written to the database, a log or browser storage.
- Browser storage holds only light preferences, such as theme and model choice.
- Please upload fictional or redacted documents while the project is in beta.

## Quick start

**Requirements:** Python 3.11+, Node 20.19+, and PostgreSQL 15+ with pgvector (a local install, or a free hosted database that includes it, such as Neon or Supabase).

```bash
# 1. Database
#    CREATE DATABASE copilot;
#    (the first migration runs CREATE EXTENSION IF NOT EXISTS vector)

# 2. Configure (from the repo root)
cp .env.example .env        # Windows: copy .env.example .env
# edit DATABASE_URL in .env

# 3. Backend
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload       # http://localhost:8000

# 4. Worker (new terminal, same venv, only needed for reminders)
python -m app.worker.main

# 5. Frontend (new terminal)
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

Open http://localhost:5173, create an account, then paste your own OpenRouter key into the key box inside the app. Get one at [openrouter.ai/keys](https://openrouter.ai/keys). Model ids change over time, so check them at [openrouter.ai/models](https://openrouter.ai/models) and edit `MODELS` in `backend/app/services/openrouter.py` if one is retired.

### Main settings

All settings come from environment variables or the repo-root `.env`. See [.env.example](./.env.example).

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://user:password@host:port/db` |
| `FRONTEND_ORIGIN` | The only origin CORS allows |
| `SESSION_SECRET` | Required in production, 32+ random characters |
| `ENVIRONMENT` | `production` turns on secure cookies and hides `/docs` |
| `RUN_WORKER_IN_API` | `true` runs the worker inside the API, for hosts with no worker service |

## Testing

```bash
cd backend  && pytest      # needs a database whose name ends in _test
cd frontend && npm test
```

The repository has 160+ backend tests and 160+ frontend tests. They cover authentication, key handling, generation, validation, retrieval, the job queue, migrations and the UI. The OpenRouter API is replaced with a scripted stand-in, so tests need no key and cost nothing. The backend tests refuse to run against any database whose name does not end in `_test`.

To run the quality checks against the fixed dataset:

```bash
cd backend && python -m evals.run
```

## Deployment

The project is designed to run on free tiers as a **beta**:

| Part | Service |
|---|---|
| Frontend | Vercel |
| API | Render (free web service) |
| Database | A free hosted Postgres with pgvector (Neon or Supabase) |
| Reminder worker | A scheduled GitHub Actions workflow |

Free tiers sleep when idle, have usage limits and carry terms that exclude production or commercial use, so treat this setup as a demo. Step-by-step instructions are in [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Project structure

```text
.
├── backend/
│   ├── app/
│   │   ├── api/          # routes: auth, ai, content, knowledge, plans, calendar, brand, health
│   │   ├── core/         # config, security, error handling
│   │   ├── db/           # engine and session
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic request and response models
│   │   ├── services/     # generation, evaluation, retrieval, job queue, OpenRouter client
│   │   └── worker/       # reminder worker process
│   ├── migrations/       # Alembic migrations
│   ├── tests/            # pytest suite
│   └── evals/            # fixed dataset and evaluation runner
├── frontend/
│   └── src/              # pages, components, hooks, API client, tests
├── docs/
│   ├── ARCHITECTURE.md
│   └── DEPLOYMENT.md
├── .github/workflows/    # scheduled reminder worker
├── render.yaml           # Render blueprint
└── .env.example
```

## Status and roadmap

**Status: beta.** The core workflow works end to end, but no real-user load testing has been done.

**Known limits**
- Repeat detection compares wording, so it misses the same idea phrased differently.
- No drag-to-reschedule on the calendar, and a single draft cannot be regenerated on its own.
- No LinkedIn API connection, no post analytics and no auto-posting, by design.
- Prompt-injection defences reduce risk but cannot remove it, so model output is checked rather than assumed correct.

**Planned**
- Login throttling and per-user limits on AI calls
- Account deletion and data export
- Regenerating a single draft, and drag-to-reschedule
- Learning your voice from your own post history (for example from LinkedIn's data export)

## Documentation

- [Architecture](./docs/ARCHITECTURE.md): how the system works, with diagrams, the data model, the security model and trade-offs
- [Deployment](./docs/DEPLOYMENT.md): going live on free tiers

## License

Released under the MIT License. See the `LICENSE` file.