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

## Part 2 — Render: Backend API

### Option A — Blueprint (recommended)

1. Render Dashboard → **New +** → **Blueprint**.
2. Connect your GitHub repo.
3. Render reads `render.yaml` and creates **neurolearn-api** + **neurolearn-agent**.
4. When prompted, fill in **secret** env vars (`sync: false` in blueprint).

### Option B — Manual web service

1. **New +** → **Web Service** → connect repo.
2. Settings:

| Field | Value |
|-------|--------|
| **Name** | `neurolearn-api` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r backend/requirements.txt -r agent_service/requirements.txt` |
| **Start Command** | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/api/stack/health` |

3. **Environment** — add all backend secrets (see [Env var reference](#env-var-reference-both-render-services)).

4. Deploy → copy URL: `https://neurolearn-api.onrender.com`

### Verify backend

```bash
curl https://neurolearn-api.onrender.com/
curl https://neurolearn-api.onrender.com/api/stack/health
```

Expect Qdrant, Lyzr, and Omi sections to show ready/active.

---

## Part 3 — Render: Agent Service

If you used the blueprint, this service is created automatically. Otherwise:

1. **New +** → **Web Service** (same repo).
2. Settings:

| Field | Value |
|-------|--------|
| **Name** | `neurolearn-agent` |
| **Build Command** | `pip install -r backend/requirements.txt -r agent_service/requirements.txt` |
| **Start Command** | `uvicorn agent_service.main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/agents/health` |

3. **Same env vars** as backend (Lyzr, Qdrant, Deepgram, etc.).

4. Copy URL: `https://neurolearn-agent.onrender.com`

> Render assigns `$PORT` dynamically — do **not** hardcode `8000` or `8001`.

### Verify agent

```bash
curl https://neurolearn-agent.onrender.com/agents/health
```

WebSocket endpoint (used by browser):

```
wss://neurolearn-agent.onrender.com/ws/agent-stream
```

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

## Env var reference (both Render services)

Set these on **neurolearn-api** and **neurolearn-agent**:

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
| `runtime.txt` | Python 3.12 for Render |
| `src/services/api.ts` | `VITE_*` URL resolution + WebSocket helpers |
| `.env.example` | Documents local + production vars |

See also: [HACKATHON_SETUP.md](./HACKATHON_SETUP.md) for local dev and Lyzr agent setup.
