from abc import ABC, abstractmethod
from typing import Tuple, Dict, Any

class OrchestratorProvider(ABC):
    @abstractmethod
    def process_command(self, transcript: str, user_id: str = "demo-user") -> Tuple[str, str, Any]:
        """Processes user commands and returns a tuple: (intent_name, textual_response, agent_action_payload)."""
        pass
