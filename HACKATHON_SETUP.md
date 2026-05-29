# NeuroLearn OS — Hackathon Setup Guide

**Required stack:** Omi Voice · Qdrant · Lyzr Multi-Agent

---

## Quick start (5 steps)

```bash
# 1. Start Qdrant
docker compose up -d

# 2. Fill in .env (Lyzr agent IDs + OMI_DEEPGRAM_API_KEY)
# See sections below

# 3. Backend API
python -m backend.main          # → http://localhost:8000

# 4. Agent service (voice + orchestration)
python -m agent_service.main      # → http://localhost:8001

# 5. Frontend
npm run dev                       # → http://localhost:5173
```

**Verify stack:**
```bash
curl http://localhost:8000/api/stack/health
curl http://localhost:8001/agents/health
```

---

## 1. Qdrant (Vector Database)

### Local (recommended for hackathon)

```bash
docker compose up -d
```

Your `.env` should have:
```env
QDRANT_URL=http://localhost:6333
MEMORY_PROVIDER=qdrant
```

Collections created automatically on startup:
- `lecture_memory_collection`
- `tutoring_memory_collection`
- `quiz_performance_collection`
- `cognitive_profile_collection`
- `voice_command_collection`

### Qdrant Cloud (for hosted demo)

1. Create cluster at [https://cloud.qdrant.io](https://cloud.qdrant.io)
2. Copy cluster URL + API key into `.env`:
```env
QDRANT_URL=https://xxxx.cloud.qdrant.io
QDRANT_API_KEY=your-key
```

### Dashboard
Open [http://localhost:6333/dashboard](http://localhost:6333/dashboard) to inspect vectors.

---

## 2. Omi Voice

Omi's cloud platform uses **Deepgram Nova** for speech-to-text at `wss://api.omi.me/v4/listen`.

For this **web app**, NeuroLearn uses the same STT engine via `OmiVoiceProvider`:

```env
VOICE_PROVIDER=omi
OMI_DEEPGRAM_API_KEY=your-deepgram-api-key
```

### Get a Deepgram key (free tier)
1. Sign up at [https://console.deepgram.com](https://console.deepgram.com)
2. Create an API key
3. Paste into `.env` as `OMI_DEEPGRAM_API_KEY`

### How it works
- Mic audio → streamed to agent service WebSocket
- `OmiVoiceProvider` → Deepgram REST API (Nova-2)
- Transcript → Lyzr orchestrator → specialist agents
- Results stored in **Qdrant**

### Omi hardware (optional)
If you have an Omi wearable + Firebase account:
```env
OMI_UID=your-firebase-user-id
```
Real-time listen URL: `wss://api.omi.me/v4/listen?uid=...`

### Fallback
If `OMI_DEEPGRAM_API_KEY` is empty, voice falls back to **browser Web Speech API** (Chrome/Edge only).

---

## 3. Lyzr Multi-Agent Orchestration

All agents call **Lyzr Studio** at:
```
https://agent-prod.studio.lyzr.ai/v3/inference/chat/
```

### Create agents in Lyzr Studio

Go to [https://studio.lyzr.ai](https://studio.lyzr.ai) and create **7 agents**:

| Agent | Env var for ID | Role |
|-------|----------------|------|
| **Orchestrator** | `ORCHESTRATOR_AGENT_LYZR_ID` | Intent classifier (JSON output) |
| **Tutor** | `TUTOR_AGENT_LYZR_ID` | Explains concepts with analogies |
| **Lecture** | `LECTURE_AGENT_LYZR_ID` | Lecture start/stop + summarization |
| **Notes** | `NOTES_AGENT_LYZR_ID` | Study notes + revision planning |
| **Quiz** | `QUIZ_AGENT_LYZR_ID` | Quiz generation + evaluation |
| **Flashcard** | `FLASHCARD_AGENT_LYZR_ID` | Spaced repetition cards |
| **Analytics** | `ANALYTICS_AGENT_LYZR_ID` | Progress + exam readiness |
| **Knowledge Graph** | `KNOWLEDGE_GRAPH_AGENT_LYZR_ID` | Concept relationships |

For each agent:
1. Create agent in Studio
2. Set **Structured JSON output** for Orchestrator (intent classifier)
3. Copy **Agent ID** from Studio
4. Paste into `.env`

Shared API key for all agents (same org):
```env
ORCHESTRATOR_AGENT_API_KEY=sk-default-xxxxx
TUTOR_AGENT_API_KEY=sk-default-xxxxx   # same key is fine
```

### Orchestrator agent instructions (paste in Studio)

See the intent classifier prompt in `agent_service/agents/intent_agent.py` or use Structured Output JSON:
```json
{"intent": "NAVIGATE_REVISION", "confidence": 0.9, "entities": {}}
```

### Multi-agent flow

```
User speaks (Omi/Deepgram STT)
    ↓
Lyzr Orchestrator Agent → {intent, confidence, entities}
    ↓
Qdrant memory retrieval (context)
    ↓
Lyzr Specialist Agent (Tutor / Quiz / Lecture / etc.)
    ↓
Qdrant store interaction + UI action
```

### Lyzr Manager Agent (advanced)

In Studio, enable **Manager Agent** on Orchestrator and `@mention` specialist agents.
Then route everything through one manager agent ID.

---

## Architecture

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│  React UI   │ ─────────────────► │  Agent Service   │
│  (Omi mic)  │                    │  :8001           │
└─────────────┘                    └────────┬─────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              OmiVoiceProvider      LyzrProvider (×7)      QdrantMemory
              (Deepgram STT)      (Studio agents)        (vectors)
                    │                     │                     │
                    └─────────────────────┴─────────────────────┘
                                          │
┌─────────────┐     REST API     ┌────────▼─────────┐
│  Dashboard  │ ◄─────────────── │  Backend :8000   │
│  Analytics  │                  │  + Qdrant + Lyzr │
└─────────────┘                  └──────────────────┘
```

---

## Hosting for demo

### Minimum (local demo)
- Docker (Qdrant)
- 3 terminals: backend, agent_service, npm run dev

### Cloud deploy

| Component | Suggestion |
|-----------|------------|
| Frontend | Vercel / Netlify |
| Backend + Agent | Railway / Render (2 services) |
| Qdrant | Qdrant Cloud |
| Lyzr | Already hosted (Studio API) |
| Omi STT | Deepgram API key |

Set production URLs:
```env
VITE_API_BASE=https://your-backend.railway.app
VITE_AGENT_WS_BASE=wss://your-agent.railway.app
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Voice not transcribing | Set `OMI_DEEPGRAM_API_KEY` in `.env`, restart agent service |
| Agent disabled in health | Set `{AGENT}_AGENT_LYZR_ID` for that agent in `.env` |
| Qdrant connection failed | Run `docker compose up -d`, check `QDRANT_URL` |
| Intent always REJECTED | Orchestrator Lyzr agent must return JSON with confidence ≥ 0.6 |
| Stack health check | `GET http://localhost:8000/api/stack/health` |

---

## Demo script for judges

1. Show `GET /api/stack/health` — all three technologies active
2. Say **"Open revision centre"** — Lyzr orchestrator classifies → navigates
3. Say **"Explain BCNF normalization"** — Lyzr tutor responds with Qdrant context
4. Record a lecture — Omi STT transcribes → Qdrant stores memory
5. Open Qdrant dashboard — show vector collections populated
