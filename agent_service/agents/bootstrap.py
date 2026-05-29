"""
Agent Bootstrap — Initialize all distributed agents with isolated LLM providers.
"""

from typing import Dict, Any, Optional
from agent_service.providers.agent_provider_factory import AgentProviderFactory
from agent_service.agents.intent_agent import IntentAgent
from agent_service.agents.tutor_agent import TutorAgent
from agent_service.agents.quiz_agent import QuizAgent
from agent_service.agents.lecture_agent import LectureAgent
from agent_service.agents.summary_agent import SummaryAgent
from agent_service.agents.navigation_agent import NavigationAgent
from agent_service.agents.flashcard_agent import FlashcardAgent
from agent_service.agents.notes_agent import NotesAgent
from agent_service.agents.analytics_agent import AnalyticsAgent
from agent_service.agents.knowledge_graph_agent import KnowledgeGraphAgent
from agent_service.agents.educational_quality_agent import EducationalQualityAgent


class AgentBootstrap:
    """Singleton bootstrap registry for all specialist agents."""

    _instance: Optional["AgentBootstrap"] = None

    def __init__(self):
        self.agents: Dict[str, Any] = {}
        self.health: list = []
        self._initialized = False

    @classmethod
    def get_instance(cls) -> "AgentBootstrap":
        if cls._instance is None:
            cls._instance = AgentBootstrap()
        return cls._instance

    def initialize(self) -> list:
        """Bootstrap all agents with isolated providers. Returns health report."""
        if self._initialized:
            return self.health

        print("\n[AgentBootstrap] --- Initializing Distributed Agent Network ---")

        agent_specs = [
            ("orchestrator", IntentAgent, "intent"),
            ("intent", IntentAgent, "intent"),
            ("tutor", TutorAgent, "tutor"),
            ("quiz", QuizAgent, "quiz"),
            ("lecture", LectureAgent, "lecture"),
            ("summary", SummaryAgent, "notes"),
            ("navigation", NavigationAgent, "orchestrator"),
            ("flashcard", FlashcardAgent, "flashcard"),
            ("notes", NotesAgent, "notes"),
            ("analytics", AnalyticsAgent, "analytics"),
            ("knowledge_graph", KnowledgeGraphAgent, "knowledge_graph"),
            ("educational_quality", EducationalQualityAgent, "quiz"),
        ]

        self.health = []
        for registry_id, agent_cls, llm_id in agent_specs:
            llm = AgentProviderFactory.create(llm_id)
            config = AgentProviderFactory.get_config(llm_id)

            if config.enabled:
                self.agents[registry_id] = agent_cls(llm=llm)
                status = "active"
            else:
                self.agents[registry_id] = None
                status = "disabled"

            entry = {
                **config.to_public_dict(),
                "name": config.display_name,
                "status": status,
                "healthy": config.enabled,
            }
            self.health.append(entry)

            stream_label = "enabled" if config.streaming else "disabled"
            print(
                f"[AgentBootstrap] Loaded: {config.display_name}\n"
                f"  Provider: {config.provider} | Model: {config.model}\n"
                f"  Temperature: {config.temperature} | Streaming: {stream_label}\n"
                f"  Status: {status.upper()} | API configured: {config.api_configured}"
            )

        active = sum(1 for h in self.health if h["enabled"])
        print(f"[AgentBootstrap] --- {active}/{len(self.health)} agents active ---\n")
        self._initialized = True
        return self.health

    def reload(self) -> list:
        """Hot-reload all agent configs and reinitialize."""
        from agent_service.providers import factory
        AgentProviderFactory.reload()
        factory.reset_provider_cache()
        self.agents.clear()
        self._initialized = False
        return self.initialize()

    def get_agent(self, agent_id: str):
        if not self._initialized:
            self.initialize()
        return self.agents.get(agent_id)

    def get_health(self) -> list:
        if not self._initialized:
            self.initialize()
        return AgentProviderFactory.get_all_health()


def bootstrap_agents() -> list:
    return AgentBootstrap.get_instance().initialize()
