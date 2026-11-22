<div align="center">

# LinkedIn Growth Copilot

**Turn your own notes, transcripts and ideas into LinkedIn posts that sound like you, with every claim checked against your source, a weekly plan, and a reminder when it is time to post.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white)
![Tested with](https://img.shields.io/badge/tested%20with-pytest%20%2B%20Vitest-blue)
![Status](https://img.shields.io/badge/status-beta-orange)

[Overview](#overview) · [Features](#features) · [Architecture](#architecture) · [Engineering](#engineering-highlights) · [Security](#security-and-privacy) · [Run it locally](#run-it-locally) · [Roadmap](#roadmap-and-known-limits)

</div>

<!--
SCREENSHOTS (strongly recommended): take 3 real screenshots of the running app, save them in docs/screenshots/,
then remove the comment markers around the lines below.

<p align="center">
  <img src="docs/screenshots/studio.png" width="860" alt="Studio: source text on the left, three generated drafts on the right"><br>
  <sub>Studio: from raw notes to three structured drafts, each claim checked against the source.</sub>
</p>
-->

## Overview

Most professionals already have what makes a good LinkedIn post: call notes, interview transcripts, lessons from client work. Turning that into consistent posts is the slow part. Generic AI writing tools can invent details, repeat themselves and sound like everyone else.

**Copilot is built around fixing those three problems:**

| Problem with generic AI writing | What Copilot does instead |
|---|---|
| It invents facts | Every insight must carry a quote from *your* source. The server checks the quote really occurs in the text and shows the claim as supported or not. |
| It repeats itself | Code (not the model) compares each draft with your earlier posts and flags overlap and the words you told it to avoid. |
| It sounds generic | A brand voice (tone, audience, structure, example posts) and a personal knowledge base of your own notes steer every generation. |

It is also designed so that users can trust it with their account and their money:

- **No shared API key.** Each user brings their own [OpenRouter](https://openrouter.ai) key. It lives in browser memory only and is never stored or logged by the server.
- **No LinkedIn login, no auto-posting.** Copilot reminds you when a post is due. You publish it yourself.

## Features

**From source to draft**
- **Studio.** Paste a post, transcript, article, notes or an idea. The app cleans it up (strips HTML, timestamps and invisible characters), extracts insights with supporting quotes, and generates three clearly different drafts in one of seven formats: story, educational, lessons, technical, framework, poll or carousel. Edit with autosave, then approve or reject with a reason.
- **Brand voice.** Tone, audience, expertise, content pillars, preferred structure, words to avoid and example posts. Reasons you give when rejecting a draft are fed back into the next generation so the same mistake is not repeated.
- **Knowledge base.** Paste your own notes. They are chunked, embedded and used to ground drafts. Retrieval is always scoped to the signed-in user.

**Quality you can see**
- **Quality check.** Two layers. The server flags repetition against your earlier posts and your avoid-words. An optional model review scores five criteria (hook, clarity, specificity, voice fit, call to action) from 1 to 5. The overall number is computed by the server, so the model cannot award itself a grade. It is advice, not a prediction of reach.
- **Library.** Every draft, approved, rejected, scheduled and published post, filterable by status.

**From idea to calendar**
- **Planner.** Give a goal and a number of posts per week. The app proposes a plan across your content pillars, using your notes and avoiding titles you already used. Turn any card into a draft.
- **Calendar and reminders.** Schedule in your own timezone. A background worker marks posts as due and you publish and mark them done. The calendar warns you if the worker has not been seen recently.

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

The browser talks only to the API. The API checks who you are, applies the rules, and calls OpenRouter with the user's key only when an AI action needs it. A separate worker process watches the database for scheduled posts that have come due. The database is also the job queue, so there is no Redis and no message broker to run.

The full walkthrough, with the data model, the failure modes and the design trade-offs, is in **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

### What happens when you click Generate

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

The model call is only one step. Everything around it is ordinary code that does not trust the model.

## Engineering highlights

| Challenge | Approach | Where |
|---|---|---|
| **Reminders must survive crashes and restarts** | A job queue inside PostgreSQL. Workers claim jobs atomically with `FOR UPDATE SKIP LOCKED`, hold a time-limited lease, and retry with exponential backoff (3 attempts, 60 s then 120 s). The attempt number acts as a fencing token, so a stale worker cannot overwrite a newer result. A partial unique index allows only one live job per post. | `backend/app/services/jobs.py`, migration `0004` |
| **Model output can be malformed** | One shared `chat_json` helper for every AI call: JSON mode, Pydantic validation, and a single repair retry that tells the model which fields failed. If one draft out of three is bad, it is dropped and the other two are kept. | `backend/app/services/generate.py` |
| **Models invent facts** | Each insight carries a supporting quote. The server verifies the quote against the source (ignoring case and punctuation) and shows the result as supported or not. | `backend/app/services/source.py` |
| **Prompt injection** | User text is wrapped in fenced tags (`<source>`, `<voice>`, `<knowledge>`) and the system prompt states that content inside them is data, never instructions. Text that looks like the app's own tags is stripped first, so it cannot close a fence early. | `backend/app/services/generate.py` |
| **Semantic search can fail** | pgvector cosine search in the same database, filtered by `user_id`, with a PostgreSQL full-text (GIN) fallback when embeddings are unavailable. Notes still save and are still found. | `backend/app/services/knowledge.py`, migration `0003` |
| **Model scores are not evidence** | Repetition and avoid-word checks are pure code. The overall review score is computed on the server from validated sub-scores, and any total sent by the model is ignored. | `backend/app/services/evaluate.py` |
| **The model proposes, the server decides** | For the weekly plan, extra posts are cut, ids are replaced with server-generated ones and posts are sorted, so a misbehaving model cannot corrupt the plan. | `backend/app/services/planner.py` |
| **Time zones and daylight saving** | Times are stored in UTC and converted in the browser. The server rejects a time that arrives without a timezone. | `backend/app/api/calendar.py`, `frontend/src/lib/tz.js` |
| **Is a prompt or model change an improvement?** | A fixed, human-labelled dataset and a runner. The deterministic detectors run with no key and no cost, and a model can optionally be compared with the human scores. | `backend/evals/` |
| **A secret key in a browser app** | The key lives in one module variable, never in web storage, cookies or URLs. It is forgotten on logout, reload, an expired session and after 30 minutes without activity. The idle clock also checks when a sleeping tab wakes up, because browsers pause timers in background tabs. | `frontend/src/api/keyStore.js` |

### Design decisions and trade-offs

| Decision | Why | What it costs |
|---|---|---|
| Bring your own key, held only in memory | No shared key to leak or pay for, and no server-side secret store | Users paste the key again after a reload or idle period |
| Reminder instead of auto-posting | No LinkedIn credentials, no API approval process, no risk of posting something wrong | The user posts manually |
| PostgreSQL as the queue | One system to run, jobs survive restarts, and a post and its job stay consistent in one transaction | Polling every few seconds instead of instant push, and not meant for very high volume |
| Separate worker process | Reminders fire even when nobody is using the app or the API restarts | A second process to keep running |
| pgvector in the same database | Embeddings and user data are filtered together by `user_id`, with no second datastore | Needs a Postgres host that supports pgvector |
| Server computes scores and checks quotes | Model output cannot grade itself | Repeat detection is lexical, so it misses the same idea in different words |
| No TypeScript, Redis or Docker | A smaller surface to learn and run locally | Fewer guardrails from a type checker, so tests carry more weight |

## Security and privacy

- **Passwords** are hashed with argon2, with a dummy hash so login timing does not reveal which emails are registered.
- **Sessions** use a signed `HttpOnly`, `SameSite=Lax` cookie that lasts 7 days and is `Secure` in production. In production the API refuses to start with a weak `SESSION_SECRET`.
- **Isolation.** Every query is scoped by `user_id`. Another user's records return 404, never 403, so their existence is not revealed.
- **CORS** allows only the configured frontend origin, and the interactive API docs are hidden in production.
- **Logs** redact keys and bearer tokens. The OpenRouter key never reaches the database, a log line or browser storage. Browser storage holds only light preferences such as the theme and chosen model.
- **AI input and output are untrusted.** See prompt-injection handling above. Provider errors are mapped to fixed messages, so internal details are not leaked.
- **Privacy note for users.** Notes and sources are sent to the model provider the user chooses. Use fictional or redacted material if the content is confidential.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, JavaScript, Vite, Tailwind CSS, React Router 7, hand-written shadcn-style components, lucide icons |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, Alembic, psycopg 3 |
| Database | PostgreSQL 15+ with the pgvector extension (9 tables, 4 migrations) |
| Auth | Server-side sessions, argon2 password hashes, signed cookie (`itsdangerous`) |
| AI | OpenRouter with each user's own key: a curated list of chat models plus an embedding model (1,536 dimensions by default) |
| Worker | A separate Python process using PostgreSQL as its queue |
| Testing | pytest, Vitest, Testing Library |

## Quality and testing

```bash
cd backend  && pytest        # needs a database whose name ends in _test
cd frontend && npm test
```

The repository has 160+ backend tests and 160+ frontend tests covering authentication, key handling, generation and validation, retrieval, the job queue, migrations and the user interface. The OpenRouter API is replaced by a scripted stand-in in the tests, so they need no key and cost nothing. The backend tests refuse to run against any database whose name does not end in `_test`, so they can never touch real data.

To run the quality checks against the fixed evaluation dataset:

```bash
cd backend && python -m evals.run
```

## Run it locally

**Requirements:** Python 3.11+, Node 20.19+ (22 recommended) and PostgreSQL 15+ with the pgvector extension.

```bash
# 1. Create the database (the first migration runs CREATE EXTENSION IF NOT EXISTS vector)
#    CREATE DATABASE copilot;

# 2. Configure, from the repository root
cp .env.example .env          # Windows: copy .env.example .env
# then edit DATABASE_URL in .env

# 3. Backend
cd backend
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload       # http://localhost:8000

# 4. Worker (new terminal, same virtual environment; only needed for reminders)
python -m app.worker.main

# 5. Frontend (new terminal)
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

Open http://localhost:5173 and create an account. Then paste your own OpenRouter key into the key box inside the app. You can create one at [openrouter.ai/keys](https://openrouter.ai/keys). Model ids change over time, so check them at [openrouter.ai/models](https://openrouter.ai/models) and edit `MODELS` in `backend/app/services/openrouter.py` if one has been retired.

### Settings

All settings come from environment variables or the `.env` file in the repository root. See [`.env.example`](./.env.example).

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://user:password@host:port/database` |
| `FRONTEND_ORIGIN` | The only origin CORS allows (default `http://localhost:5173`) |
| `SESSION_SECRET` | Required in production: 32 or more random characters |
| `ENVIRONMENT` | `production` turns on secure cookies and hides `/docs` |
| `EMBEDDING_MODEL`, `EMBEDDING_DIM` | Default `openai/text-embedding-3-small` and `1536`. The dimension must match the database column |
| `WORKER_POLL_SECONDS`, `WORKER_MAX_ATTEMPTS`, `WORKER_LOCK_TIMEOUT_SECONDS` | Worker polling, retries and lease length |
| `RUN_WORKER_IN_API` | `true` runs the worker loop inside the API process |

## API overview

All routes live under `/api`, and errors use one shape: `{"error": {"code": "...", "message": "..."}}`. Interactive docs are at `/docs` in development.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET` and `PATCH /auth/me` |
| AI (key required) | `POST /ai/validate-key`, `GET /ai/models`, `POST /ai/summarize`, `POST /ai/generate`, `POST /ai/evaluate` |
| Content | `GET` and `POST /content`, `GET`, `PATCH` and `DELETE /content/{id}`, `GET` and `POST /content/{id}/feedback` |
| Brand voice | `GET` and `PUT /brand` |
| Knowledge | `GET` and `POST /knowledge`, `DELETE /knowledge/{id}`, `POST /knowledge/reindex`, `GET /knowledge/search` |
| Plans | `GET` and `POST /plans`, `GET`, `PATCH` and `DELETE /plans/{id}` |
| Calendar | `GET` and `POST /calendar`, `DELETE /calendar/{id}`, `POST /calendar/{id}/published`, `GET /jobs/{id}` |
| Health | `GET /health`, `GET /health/db` |

## Repository structure

```text
.
├── backend/
│   ├── app/
│   │   ├── api/          # routes
│   │   ├── core/         # configuration, security, error handling
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
│   └── ARCHITECTURE.md   # how the system works in depth
└── .env.example
```

## Roadmap and known limits

**Status: beta.** The core workflow works end to end. The project has not been load-tested with real users.

**Known limits**
- Repeat detection compares wording, so it can miss the same idea expressed in different words.
- The calendar has no drag-to-reschedule, and a single draft cannot be regenerated on its own.
- The Analytics page is a placeholder. The database has a table for post metrics, but nothing fills it yet.
- There is no LinkedIn API connection and no auto-posting, by design.
- Prompt-injection defences reduce risk but cannot remove it, which is why model output is checked and never assumed correct.

**Planned**
- Login throttling and per-user limits on AI calls
- Account deletion and data export
- Regenerating a single draft, and drag-to-reschedule
- Post analytics
- Learning a user's voice from their own post history, for example from LinkedIn's data export

<!--
ABOUT THE AUTHOR (optional, recommended): remove the comment markers and fill this in.

## Author

Built by **Your Name**. [GitHub](https://github.com/YOUR-USERNAME) · [LinkedIn](https://www.linkedin.com/in/YOUR-PROFILE)
-->

## License

Released under the MIT License. See the `LICENSE` file.