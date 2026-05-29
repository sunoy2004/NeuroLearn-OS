"""
Distributed per-agent LLM configuration loader.

Each agent reads isolated env vars only (no global API key fallbacks):
  {AGENT}_AGENT_PROVIDER, {AGENT}_AGENT_API_KEY, {AGENT}_AGENT_MODEL,
  {AGENT}_AGENT_TEMPERATURE, {AGENT}_AGENT_STREAMING, {AGENT}_AGENT_LYZR_ID
"""

from dataclasses import dataclass
from typing import Dict
from agent_service.config import settings


@dataclass
class AgentLLMConfig:
    agent_id: str
    display_name: str
    provider: str
    api_key: str
    model: str
    temperature: float
    streaming: bool
    lyzr_agent_id: str = ""
    enabled: bool = True
    healthy: bool = True
    api_configured: bool = False

    def to_public_dict(self) -> dict:
        """Safe for frontend — never exposes api_key."""
        return {
            "agent": self.agent_id,
            "agent_id": self.agent_id,
            "display_name": self.display_name,
            "provider": self.provider,
            "model": self.model,
            "temperature": self.temperature,
            "streaming": self.streaming,
            "lyzr_agent_id": self.lyzr_agent_id or None,
            "enabled": self.enabled,
            "healthy": self.healthy,
            "api_configured": self.api_configured,
            "status": "active" if self.enabled and self.healthy else "disabled",
        }


AGENT_ENV_PREFIXES: Dict[str, str] = {
    "orchestrator": "ORCHESTRATOR",
    "intent": "ORCHESTRATOR",
    "navigation": "ORCHESTRATOR",
    "lecture": "LECTURE",
    "notes": "NOTES",
    "summary": "NOTES",
    "flashcard": "FLASHCARD",
    "quiz": "QUIZ",
    "tutor": "TUTOR",
    "analytics": "ANALYTICS",
    "knowledge_graph": "KNOWLEDGE_GRAPH",
    "educational_quality": "QUIZ",
}

AGENT_DISPLAY_NAMES: Dict[str, str] = {
    "orchestrator": "Orchestrator Agent",
    "intent": "Intent Agent",
    "navigation": "Navigation Agent",
    "lecture": "Lecture Agent",
    "notes": "Notes Agent",
    "summary": "Summary Agent",
    "flashcard": "Flashcard Agent",
    "quiz": "Quiz Agent",
    "tutor": "Tutor Agent",
    "analytics": "Analytics Agent",
    "knowledge_graph": "Knowledge Graph Agent",
    "educational_quality": "Educational Quality Checker Agent",
}

DEFAULT_MODELS: Dict[str, str] = {
    "orchestrator": "gpt-4o-mini",
    "lecture": "llama-3.3-70b-versatile",
    "notes": "llama-3.3-70b-versatile",
    "flashcard": "llama-3.1-8b-instant",
    "quiz": "llama-3.3-70b-versatile",
    "tutor": "llama-3.3-70b-versatile",
    "analytics": "llama-3.1-8b-instant",
    "knowledge_graph": "llama-3.3-70b-versatile",
}

DEFAULT_TEMPERATURES: Dict[str, float] = {
    "orchestrator": 0.2,
    "lecture": 0.3,
    "notes": 0.4,
    "flashcard": 0.5,
    "quiz": 0.6,
    "tutor": 0.7,
    "analytics": 0.2,
    "knowledge_graph": 0.4,
}


def _is_valid_api_key(key: str) -> bool:
    if not key or not key.strip():
        return False
    lowered = key.lower()
    return "dummy" not in lowered and not key.startswith("YOUR_")


def load_agent_config(agent_id: str) -> AgentLLMConfig:
    """Load isolated config for a single agent — per-agent env vars only."""
    prefix = AGENT_ENV_PREFIXES.get(agent_id, agent_id.upper())
    display = AGENT_DISPLAY_NAMES.get(agent_id, agent_id.replace("_", " ").title())

    provider = getattr(settings, f"{prefix}_AGENT_PROVIDER", "") or "local"
    provider = provider.lower().strip()

    api_key = (getattr(settings, f"{prefix}_AGENT_API_KEY", "") or "").strip()
    if not api_key and provider == "lyzr":
        api_key = (getattr(settings, "ORCHESTRATOR_AGENT_API_KEY", "") or "").strip()
    lyzr_agent_id = (getattr(settings, f"{prefix}_AGENT_LYZR_ID", "") or "").strip()

    model = getattr(settings, f"{prefix}_AGENT_MODEL", "") or DEFAULT_MODELS.get(agent_id, "llama-3.3-70b-versatile")
    temp_raw = getattr(settings, f"{prefix}_AGENT_TEMPERATURE", None)
    temperature = float(temp_raw) if temp_raw is not None and str(temp_raw) != "" else DEFAULT_TEMPERATURES.get(agent_id, 0.3)

    streaming_raw = getattr(settings, f"{prefix}_AGENT_STREAMING", None)
    streaming = True if streaming_raw is None or str(streaming_raw).lower() in ("1", "true", "yes") else False

    if provider == "local":
        enabled = True
        api_configured = False
    elif provider == "lyzr":
        api_configured = (
            _is_valid_api_key(api_key)
            and bool(lyzr_agent_id)
            and not lyzr_agent_id.startswith("YOUR_")
        )
        enabled = api_configured
    else:
        api_configured = _is_valid_api_key(api_key)
        enabled = api_configured

    return AgentLLMConfig(
        agent_id=agent_id,
        display_name=display,
        provider=provider,
        api_key=api_key,
        model=model,
        temperature=temperature,
        streaming=streaming,
        lyzr_agent_id=lyzr_agent_id,
        enabled=enabled,
        healthy=enabled,
        api_configured=api_configured,
    )


def load_all_agent_configs() -> Dict[str, AgentLLMConfig]:
    """Load configs for all primary agents."""
    configs: Dict[str, AgentLLMConfig] = {}
    for agent_id in (
        "orchestrator", "lecture", "notes", "flashcard",
        "quiz", "tutor", "analytics", "knowledge_graph", "educational_quality",
    ):
        configs[agent_id] = load_agent_config(agent_id)
    return configs


def reload_agent_configs() -> Dict[str, AgentLLMConfig]:
    """Hot-reload all agent configs from current settings/env."""
    return load_all_agent_configs()
