# NeuroLearn OS — Deploy Guide (Render + Netlify)

Host the full hackathon stack:

| Component | Platform | URL example |
|-----------|----------|-------------|
| **Frontend** (React/Vite) | Netlify | `https://neurolearn.netlify.app` |
| **Backend API** (FastAPI :8000) | Render | `https://neurolearn-api.onrender.com` |
| **Agent Service** (WebSocket voice) | Render | `https://neurolearn-agent.onrender.com` |
| **Qdrant** | Qdrant Cloud | `https://xxxx.cloud.qdrant.io` |
| **Lyzr + Deepgram** | Already SaaS | via env vars |

---

## Part 0 — Prerequisites

### 0.1 GitHub repo
- Push this project to GitHub.
- **Never commit** `.env`, `*.db`, or API keys (see `.gitignore`).

### 0.2 Cloud accounts (free tiers)
- [Render](https://render.com) — 2 web services (backend + agent)
- [Netlify](https://netlify.com) — frontend
- [Qdrant Cloud](https://cloud.qdrant.io) — vector memory
- [Lyzr Studio](https://studio.lyzr.ai) — agents (already configured locally)
- [Deepgram](https://console.deepgram.com) — voice STT (`OMI_DEEPGRAM_API_KEY`)

### 0.3 Gather secrets from your local `.env`
Copy values for:
- `QDRANT_URL`, `QDRANT_API_KEY`
- `ORCHESTRATOR_AGENT_API_KEY` + all `*_AGENT_LYZR_ID`
- `OMI_DEEPGRAM_API_KEY`
- Optional: `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`

### 0.4 SQLite on Render (demo note)
Render free tier uses **ephemeral disk**. `neurolearn.db` resets on redeploy. Fine for hackathon demos; mention to judges if asked.

### 0.5 Python version — **required**

Render’s default is **Python 3.14**. Pin **3.12.8** so dependency wheels (e.g. `sqlalchemy`, `qdrant-client`) resolve reliably.

| Method | What to do |
|--------|------------|
| **A — Repo file** *(recommended)* | `.python-version` in repo root contains `3.12.8` |
| **B — Render env var** | On **both** services: `PYTHON_VERSION` = `3.12.8` |

Logs should show `Using Python version 3.12.8` — not `3.14.3`.

> **Note:** Lyzr Studio is called via **HTTP** (`lyzr_client.py` / `httpx`), not the legacy PyPI package `lyzr` (which only supports Python &lt; 3.12 and is **not** in `requirements.txt`).

> `runtime.txt` is **not** used by Render. Use `.python-version` or `PYTHON_VERSION`.

---

## Part 1 — Qdrant Cloud

1. Create a free cluster at [cloud.qdrant.io](https://cloud.qdrant.io).
2. Copy **Cluster URL** and **API Key**.
3. You will paste these into both Render services:

```env
QDRANT_URL=https://YOUR-CLUSTER-ID.region.cloud.qdrant.io
QDRANT_API_KEY=your-api-key
MEMORY_PROVIDER=qdrant
```

No Docker needed in production.

---

## Render quick reference — both services

| Render form field | Service 1: `neurolearn-api` | Service 2: `neurolearn-agent` |
|-------------------|----------------------------|--------------------------------|
| **Source Code** | `sunoy2004 / NeuroLearn-OS` | `sunoy2004 / NeuroLearn-OS` |
| **Name** | `neurolearn-api` | `neurolearn-agent` |
| **Project** | `NeuroLearn` / `Production` *(optional)* | Same |
| **Language** | Python 3 | Python 3 |
| **Branch** | `main` | `main` |
| **Region** | Oregon (US West) | Oregon (US West) |
| **Root Directory** | *(empty)* | *(empty)* |
| **Build Command** | `pip install -r backend/requirements.txt -r agent_service/requirements.txt` | Same |
| **Start Command** | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` | `uvicorn agent_service.main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | Free | Free |
| **Health Check Path** *(Settings)* | `/api/stack/health` | `/agents/health` |
| **Environment Variables** | Full list below | **Identical** to Service 1 |

---

## Part 2 — Render: Service 1 — Backend API (`neurolearn-api`)

Create this service **first**. Dashboard → **New +** → **Web Service**.

### Source & project

| Render form field | What to enter |
|-------------------|---------------|
| **Source Code** | `sunoy2004 / NeuroLearn-OS` (your GitHub repo) |
| **Name** | `neurolearn-api` |
| **Project** *(optional)* | Create e.g. `NeuroLearn` → Environment: `Production` |
| **Language** | `Python 3` *(Render auto-detects Python)* |
| **Branch** | `main` *(or your deploy branch)* |
| **Region** | `Oregon (US West)` *(match your other Render services)* |
| **Root Directory** | *(leave empty)* — repo root; both `backend/` and `agent_service/` must be available |

### Build & run

| Render form field | What to enter |
|-------------------|---------------|
| **Build Command** | `pip install -r backend/requirements.txt -r agent_service/requirements.txt` |
| **Start Command** | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |

> **Important:** Use `$PORT` — Render injects the port. Do **not** use `8000`.

### Instance type

| Render form field | What to select |
|-------------------|----------------|
| **Instance Type** | **Free** — *For hobby projects* |

*(Paid instances add persistent disk and zero-downtime; not required for hackathon.)*

### Advanced settings (after service is created)

Go to **Settings** → set:

| Setting | Value |
|---------|--------|
| **Health Check Path** | `/api/stack/health` |

### Environment variables — Service 1

In the **Environment Variables** section on the create/deploy form (or **Environment** tab later), add:

**Plain values (copy exactly):**

| Key | Value |
|-----|--------|
| `PYTHON_VERSION` | `3.12.8` |
| `DATABASE_URL` | `sqlite:///./neurolearn.db` |
| `MEMORY_PROVIDER` | `qdrant` |
| `VOICE_PROVIDER` | `omi` |
| `LYZR_BASE_URL` | `https://agent-prod.studio.lyzr.ai` |
| `ORCHESTRATOR_AGENT_PROVIDER` | `lyzr` |
| `ORCHESTRATOR_AGENT_MODEL` | `gpt-4o-mini` |
| `ORCHESTRATOR_AGENT_TEMPERATURE` | `0.2` |
| `ORCHESTRATOR_AGENT_STREAMING` | `true` |
| `TUTOR_AGENT_PROVIDER` | `lyzr` |
| `LECTURE_AGENT_PROVIDER` | `lyzr` |
| `NOTES_AGENT_PROVIDER` | `lyzr` |
| `QUIZ_AGENT_PROVIDER` | `lyzr` |
| `FLASHCARD_AGENT_PROVIDER` | `lyzr` |
| `ANALYTICS_AGENT_PROVIDER` | `lyzr` |
| `KNOWLEDGE_GRAPH_AGENT_PROVIDER` | `lyzr` |

**Secrets (paste from your local `.env`):**

| Key | Where to get it |
|-----|-----------------|
| `QDRANT_URL` | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | Qdrant Cloud API key |
| `OMI_DEEPGRAM_API_KEY` | Deepgram console |
| `ORCHESTRATOR_AGENT_API_KEY` | Lyzr Studio |
| `ORCHESTRATOR_AGENT_LYZR_ID` | Lyzr Studio → Orchestrator agent |
| `TUTOR_AGENT_LYZR_ID` | Lyzr Studio |
| `LECTURE_AGENT_LYZR_ID` | Lyzr Studio |
| `NOTES_AGENT_LYZR_ID` | Lyzr Studio |
| `QUIZ_AGENT_LYZR_ID` | Lyzr Studio |
| `FLASHCARD_AGENT_LYZR_ID` | Lyzr Studio |
| `ANALYTICS_AGENT_LYZR_ID` | Lyzr Studio |
| `KNOWLEDGE_GRAPH_AGENT_LYZR_ID` | Lyzr Studio |
| `OPENAI_API_KEY` | *(optional)* OpenAI |
| `DEEPGRAM_API_KEY` | *(optional)* fallback STT |

You can reuse the same Lyzr API key for `ORCHESTRATOR_AGENT_API_KEY` and set `TUTOR_AGENT_API_KEY` etc. to the same value if your local `.env` does that.

Click **Create Web Service** → wait for deploy → copy URL:

```
https://neurolearn-api.onrender.com
```

### Verify Service 1

```bash
curl https://neurolearn-api.onrender.com/
curl https://neurolearn-api.onrender.com/api/stack/health
```

Expect Qdrant, Lyzr, and Omi sections to show ready/active.

---

## Part 3 — Render: Service 2 — Agent Service (`neurolearn-agent`)

Create a **second** web service from the **same repo**. Dashboard → **New +** → **Web Service**.

### Source & project

| Render form field | What to enter |
|-------------------|---------------|
| **Source Code** | `sunoy2004 / NeuroLearn-OS` *(same repo)* |
| **Name** | `neurolearn-agent` |
| **Project** *(optional)* | Same project: `NeuroLearn` / `Production` |
| **Language** | `Python 3` |
| **Branch** | `main` *(same branch as Service 1)* |
| **Region** | `Oregon (US West)` *(same region as Service 1)* |
| **Root Directory** | *(leave empty)* |

### Build & run

| Render form field | What to enter |
|-------------------|---------------|
| **Build Command** | `pip install -r backend/requirements.txt -r agent_service/requirements.txt` |
| **Start Command** | `uvicorn agent_service.main:app --host 0.0.0.0 --port $PORT` |

> Same build command as Service 1 — the agent imports `backend` modules from the monorepo.

### Instance type

| Render form field | What to select |
|-------------------|----------------|
| **Instance Type** | **Free** — *For hobby projects* |

### Advanced settings (after service is created)

| Setting | Value |
|---------|--------|
| **Health Check Path** | `/agents/health` |

### Environment variables — Service 2

Use the **same keys and values** as Service 1 ([plain values table](#environment-variables--service-1) + [secrets table](#secrets-paste-from-your-local-env)).

The agent service reads `agent_service/config.py` and also uses `backend.database` — it needs Qdrant, Lyzr, and Deepgram configured identically.

Click **Create Web Service** → copy URL:

```
https://neurolearn-agent.onrender.com
```

WebSocket URL for the browser (used by Netlify frontend):

```
wss://neurolearn-agent.onrender.com/ws/agent-stream
```

### Verify Service 2

```bash
curl https://neurolearn-agent.onrender.com/agents/health
```

---

## Part 2B — Alternative: Render Blueprint (both services at once)

If you prefer not to fill the form twice:

1. Dashboard → **New +** → **Blueprint**.
2. Connect `sunoy2004 / NeuroLearn-OS`.
3. Render reads `render.yaml` and creates **neurolearn-api** + **neurolearn-agent** with the same build/start commands above.
4. After creation, open each service → **Environment** → add the secret keys from the tables in Part 2 & 3.

---

## Part 4 — Netlify: Frontend

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**.
2. Select your repo.
3. Netlify reads `netlify.toml` automatically:

| Setting | Value |
|---------|--------|
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| Node version | 20 |

4. **Site configuration → Environment variables** (Production):

```env
VITE_API_BASE=https://neurolearn-api.onrender.com
VITE_AGENT_API_BASE=https://neurolearn-agent.onrender.com
VITE_AGENT_WS_BASE=wss://neurolearn-agent.onrender.com
```

Replace with your actual Render URLs (**no trailing slash**).

5. **Deploy site** → copy URL: `https://your-site.netlify.app`

6. **Trigger redeploy** after changing any `VITE_*` variable (they are baked in at build time).

---

## Part 5 — Connect & verify end-to-end

### 5.1 Wake Render (free tier sleeps after ~15 min idle)

Before demo or testing, hit:

```bash
curl https://neurolearn-api.onrender.com/api/stack/health
curl https://neurolearn-agent.onrender.com/agents/health
```

First request after sleep may take **30–60 seconds**.

### 5.2 Browser checks

1. Open your Netlify URL in **Chrome** (voice works best).
2. DevTools → **Network** — API calls must go to `*.onrender.com`, **not** `localhost`.
3. Allow microphone when prompted.
4. Try: *"Generate a quiz on operating systems"*

### 5.3 Demo script for judges

1. Show `GET /api/stack/health` — Omi + Qdrant + Lyzr active
2. Voice: *"Open revision center"* → navigates
3. Voice: *"Explain BCNF"* → tutor responds
4. Record or upload a short lecture → processing pipeline
5. Show quiz / flashcards generated by topic

---

## Env var reference (copy-paste block — both Render services)

Add every line below to **both** `neurolearn-api` and `neurolearn-agent` in Render → **Environment** (replace placeholder values with your real secrets):

```env
# Database (demo)
DATABASE_URL=sqlite:///./neurolearn.db

# Qdrant Cloud
QDRANT_URL=https://YOUR-CLUSTER.cloud.qdrant.io
QDRANT_API_KEY=your-key
MEMORY_PROVIDER=qdrant

# Voice
VOICE_PROVIDER=omi
OMI_DEEPGRAM_API_KEY=your-deepgram-key

# Lyzr
LYZR_BASE_URL=https://agent-prod.studio.lyzr.ai
ORCHESTRATOR_AGENT_PROVIDER=lyzr
ORCHESTRATOR_AGENT_API_KEY=your-lyzr-key
ORCHESTRATOR_AGENT_LYZR_ID=your-id
ORCHESTRATOR_AGENT_MODEL=gpt-4o-mini
ORCHESTRATOR_AGENT_TEMPERATURE=0.2
ORCHESTRATOR_AGENT_STREAMING=true

TUTOR_AGENT_PROVIDER=lyzr
TUTOR_AGENT_API_KEY=your-lyzr-key
TUTOR_AGENT_LYZR_ID=your-id

LECTURE_AGENT_PROVIDER=lyzr
LECTURE_AGENT_LYZR_ID=your-id

NOTES_AGENT_PROVIDER=lyzr
NOTES_AGENT_LYZR_ID=your-id

QUIZ_AGENT_PROVIDER=lyzr
QUIZ_AGENT_LYZR_ID=your-id

FLASHCARD_AGENT_PROVIDER=lyzr
FLASHCARD_AGENT_LYZR_ID=your-id

ANALYTICS_AGENT_PROVIDER=lyzr
ANALYTICS_AGENT_LYZR_ID=your-id

KNOWLEDGE_GRAPH_AGENT_PROVIDER=lyzr
KNOWLEDGE_GRAPH_AGENT_LYZR_ID=your-id

# Optional
OPENAI_API_KEY=your-openai-key
DEEPGRAM_API_KEY=your-deepgram-key
```

---

## Local development vs production

| | Local | Production |
|---|--------|------------|
| Frontend | `npm run dev` → `:5173` | Netlify |
| API | `python -m backend.main` → `:8000` | Render `neurolearn-api` |
| Agent | `python -m agent_service.main` → `:8001` | Render `neurolearn-agent` |
| Qdrant | `docker compose up -d` | Qdrant Cloud |

Local `.env` is unchanged. Production uses Render/Netlify env UIs only.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails: `No matching distribution found for lyzr` | Pull latest `main` — the unused PyPI `lyzr` package was removed from `requirements.txt`. Redeploy both services. |
| Logs show `Python version 3.14` | Add env `PYTHON_VERSION` = `3.12.8` or push `.python-version` |
| UI calls `localhost` | Set `VITE_*` on Netlify and **redeploy** |
| Voice WebSocket fails | Use `wss://` in `VITE_AGENT_WS_BASE`; allow mic in Chrome |
| 502 / slow first load | Render cold start — hit health URLs 1–2 min before demo |
| Qdrant connection error | Check `QDRANT_URL` + `QDRANT_API_KEY` on **both** Render services |
| Agent disabled in health | Set missing `*_AGENT_LYZR_ID` in Render env |
| CORS errors | Backends default to `CORS_ORIGINS=["*"]` — should work with Netlify |

---

## Files added for deployment

| File | Purpose |
|------|---------|
| `render.yaml` | Render Blueprint — 2 Python services |
| `netlify.toml` | Netlify build + SPA fallback |
| `.python-version` | Pins Python **3.12.8** for Render |
| `runtime.txt` | Legacy/heroku-style pin (Render ignores this) |
| `src/services/api.ts` | `VITE_*` URL resolution + WebSocket helpers |
| `.env.example` | Documents local + production vars |

See also: [HACKATHON_SETUP.md](./HACKATHON_SETUP.md) for local dev and Lyzr agent setup.
