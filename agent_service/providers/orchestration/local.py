"""
LocalOrchestratorProvider — Wires the DistributedOrchestrator into the provider interface.

This replaces the old hardcoded if/elif chain with the new multi-agent pipeline.
Uses lazy import to avoid circular dependency with the orchestrator module.
"""

from typing import Tuple, Any
from agent_service.providers.interfaces.orchestrator import OrchestratorProvider


class LocalOrchestratorProvider(OrchestratorProvider):
    def __init__(self, llm_provider, memory_provider):
        self.llm = llm_provider
        self.memory = memory_provider
        self._orchestrator = None

    def _get_orchestrator(self):
        """Lazy-initialize the distributed orchestrator (avoids circular import)."""
        if self._orchestrator is None:
            from agent_service.orchestrator.agents import DistributedOrchestrator
            self._orchestrator = DistributedOrchestrator(memory_provider=self.memory)
        return self._orchestrator

    def process_command(self, transcript: str, user_id: str = "demo-user") -> Tuple[str, str, Any]:
        """Delegate to the DistributedOrchestrator pipeline."""
        orchestrator = self._get_orchestrator()
        return orchestrator.process_command(transcript, user_id)
