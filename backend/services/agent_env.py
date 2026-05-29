"""Read per-agent LLM credentials from environment (no global key fallbacks)."""

import os
from pathlib import Path
from typing import Optional, Tuple


def _load_dotenv_if_needed() -> None:
    """Ensure per-agent keys from .env are visible to the backend process."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


_load_dotenv_if_needed()


def _valid_key(key: Optional[str]) -> bool:
    if not key or not key.strip():
        return False
    lowered = key.lower()
    return "dummy" not in lowered and not key.startswith("YOUR_")


def get_agent_llm_credentials(agent_prefix: str) -> Tuple[Optional[str], str, Optional[str]]:
    """
    Return (api_key, provider, model) for an agent env prefix such as LECTURE or NOTES.
    """
    provider = (os.environ.get(f"{agent_prefix}_AGENT_PROVIDER") or "local").lower().strip()
    api_key = os.environ.get(f"{agent_prefix}_AGENT_API_KEY", "").strip()
    model = os.environ.get(f"{agent_prefix}_AGENT_MODEL", "llama-3.3-70b-versatile")
    if _valid_key(api_key):
        return api_key, provider, model
    return None, provider, model


def get_groq_credentials_for_backend() -> Tuple[Optional[str], str]:
    """Prefer NOTES agent Groq key, then LECTURE, then any configured groq agent."""
    for prefix in ("NOTES", "LECTURE", "TUTOR", "QUIZ", "FLASHCARD", "ANALYTICS", "KNOWLEDGE_GRAPH"):
        key, provider, model = get_agent_llm_credentials(prefix)
        if key and provider in ("groq", "grok"):
            return key, model
    return None, "llama-3.3-70b-versatile"
