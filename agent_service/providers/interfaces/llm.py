from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Iterator

class LLMProvider(ABC):
    @abstractmethod
    def chat(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> str:
        """Executes a chat completion query and returns the text response."""
        pass

    @abstractmethod
    def stream(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> Iterator[str]:
        """Streams a chat completion query token-by-token."""
        pass

    @abstractmethod
    def embeddings(self, text: str) -> List[float]:
        """Generates a numerical vector embedding for the input text."""
        pass

    @abstractmethod
    def summarize(self, text: str) -> Dict[str, Any]:
        """Summarizes lecture content and returns a dictionary with keys: title, summary, concepts."""
        pass
