from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class MemoryProvider(ABC):
    @abstractmethod
    def initialize(self) -> None:
        """Bootstraps/indexes memory tables or collections."""
        pass

    @abstractmethod
    def store_memory(self, collection_name: str, payload: Dict[str, Any], text_to_embed: str) -> str:
        """Saves dynamic context information with vector embeddings."""
        pass

    @abstractmethod
    def search_memory(self, collection_name: str, query_text: str, user_id: str = "demo-user", limit: int = 5) -> List[Dict[str, Any]]:
        """Queries dynamic vector collections for contextual semantic matches."""
        pass

    @abstractmethod
    def get_latest_cognitive_profile(self, user_id: str = "demo-user") -> Optional[Dict[str, Any]]:
        """Loads the student's cognitive metrics profile."""
        pass
