"""Disabled LLM provider — returned when an agent has no valid API key."""

from typing import List, Dict, Any, Optional, Iterator
from agent_service.providers.interfaces.llm import LLMProvider


class DisabledLLMProvider(LLMProvider):
    def __init__(self, agent_id: str, reason: str = "Missing API key"):
        self.agent_id = agent_id
        self.reason = reason

    def _msg(self) -> str:
        return f"[{self.agent_id}] Agent disabled: {self.reason}. Configure {self.agent_id.upper()}_AGENT_API_KEY in .env"

    def chat(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> str:
        return self._msg()

    def stream(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> Iterator[str]:
        yield self._msg()

    def embeddings(self, text: str) -> List[float]:
        return [0.0] * 1536

    def summarize(self, text: str) -> Dict[str, Any]:
        return {"title": "Disabled", "summary": self._msg(), "concepts": []}
