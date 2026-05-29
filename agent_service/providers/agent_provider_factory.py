"""
AgentProviderFactory — Per-agent isolated LLM provider instances.

Each agent gets its own provider, API key, model, temperature, and streaming config.
NO shared singleton across agents.
"""

from typing import Dict, Optional, Tuple
from agent_service.agent_config_loader import AgentLLMConfig, load_agent_config, reload_agent_configs
from agent_service.providers.interfaces.llm import LLMProvider

# Per-agent isolated instances: agent_id -> (provider, config)
_agent_instances: Dict[str, Tuple[LLMProvider, AgentLLMConfig]] = {}


def _create_provider(config: AgentLLMConfig) -> LLMProvider:
    """Instantiate an LLM provider from agent config."""
    if not config.enabled:
        from agent_service.providers.llm.disabled import DisabledLLMProvider
        return DisabledLLMProvider(config.agent_id, "Missing or invalid API key")

    prov = config.provider.lower().strip()

    if prov in ("groq", "grok"):
        from agent_service.providers.llm.groq import GroqProvider
        return GroqProvider(config)
    if prov == "openai":
        from agent_service.providers.llm.openai import OpenAIProvider
        return OpenAIProvider(config)
    if prov == "anthropic":
        from agent_service.providers.llm.anthropic import AnthropicProvider
        return AnthropicProvider(config)
    if prov == "lyzr":
        from agent_service.providers.llm.lyzr import LyzrProvider
        return LyzrProvider(config)

    from agent_service.providers.llm.local import LocalProvider
    return LocalProvider(config)


class AgentProviderFactory:
    @staticmethod
    def create(agent_id: str) -> LLMProvider:
        """Create or return cached isolated provider for an agent."""
        if agent_id in _agent_instances:
            return _agent_instances[agent_id][0]

        config = load_agent_config(agent_id)
        provider = _create_provider(config)
        _agent_instances[agent_id] = (provider, config)

        status = "enabled" if config.enabled else "DISABLED"
        print(
            f"[AgentProviderFactory] Agent '{agent_id}' -> {status} | "
            f"provider={config.provider} | model={config.model} | "
            f"temp={config.temperature} | streaming={'on' if config.streaming else 'off'}"
        )
        return provider

    @staticmethod
    def get_config(agent_id: str) -> AgentLLMConfig:
        if agent_id not in _agent_instances:
            AgentProviderFactory.create(agent_id)
        return _agent_instances[agent_id][1]

    @staticmethod
    def reload(agent_id: Optional[str] = None) -> None:
        """Hot-reload agent provider(s) after .env change."""
        reload_agent_configs()
        if agent_id:
            _agent_instances.pop(agent_id, None)
            AgentProviderFactory.create(agent_id)
        else:
            _agent_instances.clear()
            for aid in ("orchestrator", "lecture", "notes", "flashcard", "quiz", "tutor", "analytics", "knowledge_graph"):
                AgentProviderFactory.create(aid)

    @staticmethod
    def get_all_health() -> list:
        """Return public health status for all primary agents."""
        from agent_service.agent_config_loader import load_all_agent_configs
        configs = load_all_agent_configs()
        for aid in configs:
            if aid not in _agent_instances:
                AgentProviderFactory.create(aid)
        return [{**cfg.to_public_dict(), "name": cfg.display_name} for cfg in configs.values()]


def get_agent_llm(agent_name: str) -> LLMProvider:
    """Backward-compatible accessor used by orchestrator."""
    return AgentProviderFactory.create(agent_name)
