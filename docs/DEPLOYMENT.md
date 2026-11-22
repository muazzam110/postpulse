# Deployment

Two parts: **put the code on GitHub**, then **host it for free**. Free-tier terms change, so the numbers below were read from each provider's docs in October 2026; re-check them before relying on them. This route has not been run end to end on the live services.

## Part 1: Push to GitHub

1. Create an empty repository on github.com (no README, no .gitignore, no licence). Copy its URL.
2. In the project folder:

```bash
git init -b main
git add .
git status          # check: no .env, no .venv, no node_modules should appear
git commit -m "Initial commit: LinkedIn Growth Copilot"
git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
git push -u origin main
```

`.gitignore` already excludes `.env`, `.venv`, `node_modules` and `dist`. Never commit a real `.env`. GitHub draws the Mermaid diagrams in `README.md` and `docs/ARCHITECTURE.md` by itself, so visitors see the architecture on the repo page and in the docs folder.

## Part 2: Free hosting

| Piece | Service | Free-tier facts (from provider docs) |
|---|---|---|
| Database (PostgreSQL + pgvector) | **Neon** | 1 GB per project; 100 compute-hours per month; computes suspend after 5 minutes idle |
| API and worker | **Render** web service (Python) | Sleeps after 15 minutes without traffic, about a minute to wake; 750 free hours a month; free *background workers* are not offered, so the worker runs inside the API |
| Frontend | **Vercel** Hobby | Static hosting plus a rewrite that forwards `/api/*` to Render; Hobby is for personal, non-commercial use |

Why this layout: session cookies are `SameSite=Lax`, so the browser must see the frontend and API as one site. Vercel serves the page and forwards `/api/*` to Render, so the browser only ever talks to your Vercel address. Do not "fix" cookie problems with `SameSite=None`.

What to expect on free tiers:

- **First request after idle is slow** (about a minute while Render wakes, a moment more for Neon). Later requests are fast.
- **Reminders only fire while the API is awake.** When you open the app it wakes, the worker starts, and anything already due is picked up within seconds. The calendar shows "Due" and the "worker last seen" notice. There are no push notifications or emails, so this suits a personal tool and a demo, not guaranteed on-time delivery.
- Render's free *Postgres* expires after 30 days, which is why the database lives on Neon instead.

### Step 1: Database on Neon

1. Sign up at neon.com and create a project (any region near you).
2. Open the SQL editor and run `CREATE EXTENSION IF NOT EXISTS vector;` (Neon supports pgvector; if this errors, stop and pick another host).
3. Copy the **direct** connection string (not the "pooled" one, which can break migrations). It looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`.
4. Change the beginning to `postgresql+psycopg://`. This is your `DATABASE_URL`.

### Step 2: API on Render

1. Sign up at render.com with GitHub. Choose **New → Blueprint** and select your repo. Render reads `render.yaml`.
2. When asked, enter `DATABASE_URL` (from step 1). For `FRONTEND_ORIGIN` enter a placeholder for now; you will fix it after step 3.
3. Deploy. On each start Render runs `alembic upgrade head`, then the API. Wait until the service shows Live.
4. Open `https://YOUR-API.onrender.com/api/health/db`. It should return `status: ok` and a pgvector version.
5. If the build fails on the Python version, change `PYTHON_VERSION` in the service's Environment tab to a version Render lists (3.11 or newer works).

Without the Blueprint: create a Web Service, runtime Python, root directory `backend`, build `pip install -r requirements.txt`, start `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/api/health`, instance type Free, and set the environment variables in the table below.

### Step 3: Frontend on Vercel

1. In `frontend/vercel.json`, replace `REPLACE-WITH-YOUR-API.onrender.com` with your Render host name, then commit and push.
2. At vercel.com choose **Add New → Project**, import the repo, and set **Root Directory** to `frontend`. The Vite preset is detected (build `npm run build`, output `dist`). Leave `VITE_API_URL` unset.
3. Deploy, then copy your address (for example `https://your-app.vercel.app`).
4. Back in Render, set `FRONTEND_ORIGIN` to that address and let it redeploy.

### Step 4: Check it works

- [ ] Open the Vercel address and register (the first load may take a minute)
- [ ] Enter your OpenRouter key inside the app and generate a draft
- [ ] Schedule a post two minutes ahead; the calendar shows the worker seen and the reminder turns "Due"
- [ ] Reload the page: you stay signed in; the key is asked for again (by design)

## Environment variables

| Variable | Where | Value |
|---|---|---|
| `ENVIRONMENT` | API | `production` (secure cookies, `/docs` hidden) |
| `DATABASE_URL` | API | Neon string starting `postgresql+psycopg://` |
| `SESSION_SECRET` | API | 32+ random characters (the Blueprint generates one); the API refuses to start otherwise |
| `FRONTEND_ORIGIN` | API | Your Vercel address, no trailing slash |
| `RUN_WORKER_IN_API` | API | `true` on free hosts with no worker service |
| `EMBEDDING_MODEL`, `EMBEDDING_DIM`, `WORKER_*` | API | Optional; defaults are in `.env.example` |

There is no OpenRouter key anywhere in the configuration: every user brings their own.

## Other hosts, and paid setups

The API is a normal ASGI app and the worker a normal Python process, so any host works if it offers PostgreSQL with pgvector, can serve `dist/` as a single-page app (unknown paths rewrite to `index.html`) and keeps the frontend and API on one site (a `/api` proxy, or sibling subdomains of one domain with `VITE_API_URL` set at build time). On a host with a separate always-on worker service, leave `RUN_WORKER_IN_API` off and run `python -m app.worker.main` there. A scheduler can instead run `python -m app.worker.main --once` every few minutes.

Health checks: `/api/health` (process) and `/api/health/db` (database).
