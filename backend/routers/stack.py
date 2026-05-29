"""Hackathon stack health — Omi + Qdrant + Lyzr status."""

from fastapi import APIRouter
from backend.config import settings
from backend.services.omi_service import is_omi_configured, get_omi_stt_api_key
from backend.services.qdrant_service import get_qdrant_client, COLLECTIONS
from backend.services.lyzr_service import master_orchestrator
from backend.services.lyzr_client import get_agent_lyzr_credentials, is_lyzr_configured

router = APIRouter(prefix="/api/stack", tags=["stack"])


@router.get("/health")
def stack_health():
    """Returns status of the three required hackathon technologies."""
    # Qdrant
    qdrant_ok = False
    qdrant_detail = "not connected"
    try:
        client = get_qdrant_client()
        cols = []
        for c in COLLECTIONS:
            try:
                if client.collection_exists(c):
                    cols.append(c)
            except Exception:
                pass
        qdrant_ok = True
        qdrant_detail = f"{len(cols)}/{len(COLLECTIONS)} collections at {settings.QDRANT_URL or 'localhost:6333'}"
    except Exception as e:
        qdrant_detail = str(e)

    # Omi Voice
    omi_ok = is_omi_configured()
    omi_detail = "Deepgram STT ready" if get_omi_stt_api_key() else (
        f"OMI_UID set ({settings.OMI_UID[:8]}...)" if settings.OMI_UID else "Set OMI_DEEPGRAM_API_KEY in .env"
    )

    # Lyzr multi-agent
    lyzr_agents = master_orchestrator.get_agent_status()
    lyzr_configured = sum(1 for a in lyzr_agents if a["configured"])
    orch_key, orch_id = get_agent_lyzr_credentials("ORCHESTRATOR")

    return {
        "stack": ["Omi Voice", "Qdrant", "Lyzr Multi-Agent"],
        "omi": {
            "status": "active" if omi_ok else "needs_config",
            "provider": "omi",
            "detail": omi_detail,
            "listen_url": settings.OMI_LISTEN_URL,
        },
        "qdrant": {
            "status": "active" if qdrant_ok else "error",
            "url": settings.QDRANT_URL or "http://localhost:6333",
            "detail": qdrant_detail,
        },
        "lyzr": {
            "status": "active" if is_lyzr_configured(orch_key, orch_id) else "needs_config",
            "base_url": settings.LYZR_BASE_URL,
            "agents_configured": f"{lyzr_configured}/{len(lyzr_agents)}",
            "agents": lyzr_agents,
        },
        "memory_provider": settings.MEMORY_PROVIDER,
        "voice_provider": getattr(settings, "VOICE_PROVIDER", "omi"),
    }
