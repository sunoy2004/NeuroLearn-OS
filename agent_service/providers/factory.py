import os
from agent_service.config import settings

# Interfaces
from agent_service.providers.interfaces.llm import LLMProvider
from agent_service.providers.interfaces.voice import VoiceProvider
from agent_service.providers.interfaces.memory import MemoryProvider
from agent_service.providers.interfaces.orchestrator import OrchestratorProvider

from agent_service.providers.voice.deepgram import DeepgramVoiceProvider
from agent_service.providers.voice.elevenlabs import ElevenLabsVoiceProvider
from agent_service.providers.voice.openai import OpenAIVoiceProvider
from agent_service.providers.voice.browser import BrowserVoiceProvider

from agent_service.providers.memory.qdrant import QdrantMemoryProvider
from agent_service.providers.memory.local import LocalMemoryProvider
from agent_service.providers.orchestration.local import LocalOrchestratorProvider
from agent_service.providers.llm.local import LocalProvider

_llm = None
_voice = None
_memory = None
_orchestrator = None


def _embeddings_llm() -> LLMProvider:
    """Use the notes agent's isolated LLM for vector embeddings (no global key)."""
    from agent_service.agent_config_loader import load_agent_config
    from agent_service.providers.agent_provider_factory import AgentProviderFactory

    notes_cfg = load_agent_config("notes")
    if notes_cfg.enabled:
        return AgentProviderFactory.create("notes")
    return LocalProvider()


def get_llm_provider() -> LLMProvider:
    """Legacy accessor — returns notes agent LLM for embeddings/memory helpers."""
    global _llm
    if _llm is None:
        _llm = _embeddings_llm()
        print(f"Loading shared embeddings LLM via notes agent ({_llm.__class__.__name__})")
    return _llm


def get_voice_provider() -> VoiceProvider:
    global _voice
    if _voice is None:
        prov = settings.VOICE_PROVIDER.lower().strip()
        print(f"Loading Voice provider: {prov}")

        if prov == "deepgram" and settings.DEEPGRAM_API_KEY and "dummy" not in settings.DEEPGRAM_API_KEY:
            _voice = DeepgramVoiceProvider()
        elif prov == "omi":
            from agent_service.providers.voice.omi import OmiVoiceProvider
            _voice = OmiVoiceProvider()
            print("Using Omi Voice Provider (Deepgram STT — Omi-compatible pipeline)")
        elif prov == "elevenlabs" and settings.ELEVEN_LABS_API_KEY and "dummy" not in settings.ELEVEN_LABS_API_KEY:
            _voice = ElevenLabsVoiceProvider()
        elif prov == "openai" and settings.OPENAI_API_KEY and "dummy" not in settings.OPENAI_API_KEY:
            _voice = OpenAIVoiceProvider()
        else:
            print("Fallback: Using Browser Voice Provider")
            _voice = BrowserVoiceProvider()
    return _voice


def get_memory_provider() -> MemoryProvider:
    global _memory
    if _memory is None:
        prov = settings.MEMORY_PROVIDER.lower().strip()
        print(f"Loading Memory provider: {prov}")

        llm = _embeddings_llm()
        qdrant_url = (settings.QDRANT_URL or "").strip()
        use_qdrant = prov == "qdrant" or bool(qdrant_url)
        if use_qdrant:
            if not qdrant_url:
                settings.QDRANT_URL = "http://localhost:6333"
                print("Qdrant: using default http://localhost:6333 (run: docker compose up -d)")
            try:
                _memory = QdrantMemoryProvider(llm)
                print(f"Using Qdrant Memory Provider at {settings.QDRANT_URL}")
            except Exception as e:
                print(f"Qdrant unavailable ({e}). Falling back to Local SQLite Memory.")
                _memory = LocalMemoryProvider(llm)
        else:
            print("Fallback: Using Local SQLite Memory Provider")
            _memory = LocalMemoryProvider(llm)
        _memory.initialize()
    return _memory


def get_orchestrator_provider() -> OrchestratorProvider:
    global _orchestrator
    if _orchestrator is None:
        print("Loading Orchestrator provider: distributed (per-agent LLMs)")
        mem = get_memory_provider()
        _orchestrator = LocalOrchestratorProvider(None, mem)
    return _orchestrator


def reset_provider_cache() -> None:
    """Clear singleton caches after hot-reload."""
    global _llm, _voice, _memory, _orchestrator
    _llm = None
    _voice = None
    _memory = None
    _orchestrator = None
