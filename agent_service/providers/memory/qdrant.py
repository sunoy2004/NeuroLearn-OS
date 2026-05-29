import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from agent_service.providers.interfaces.memory import MemoryProvider
from agent_service.config import settings

class QdrantMemoryProvider(MemoryProvider):
    def __init__(self, llm_provider):
        self.llm = llm_provider
        self.client = None
        url = (settings.QDRANT_URL or "http://localhost:6333").strip()
        try:
            if settings.QDRANT_API_KEY:
                self.client = QdrantClient(url=url, api_key=settings.QDRANT_API_KEY)
            else:
                self.client = QdrantClient(url=url)
            print(f"[AgentService Qdrant] Connected to {url}")
        except Exception as e:
            print(f"[AgentService Qdrant] {url} unavailable ({e}). Using embedded storage.")
            self.client = QdrantClient(path="db_qdrant")

        self.collections = [
            "lecture_memory_collection",
            "tutoring_memory_collection",
            "quiz_performance_collection",
            "cognitive_profile_collection",
            "voice_command_collection"
        ]

    def initialize(self) -> None:
        if not self.client:
            return
        for col in self.collections:
            try:
                if not self.client.collection_exists(col):
                    self.client.create_collection(
                        collection_name=col,
                        vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
                    )
            except Exception as e:
                print(f"Failed setting up Qdrant collection {col}: {e}")

    def store_memory(self, collection_name: str, payload: Dict[str, Any], text_to_embed: str) -> str:
        if not self.client:
            return ""
        point_id = str(uuid.uuid4())
        vector = self.llm.embeddings(text_to_embed)
        self.client.upsert(
            collection_name=collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload
                )
            ]
        )
        return point_id

    def search_memory(self, collection_name: str, query_text: str, user_id: str = "demo-user", limit: int = 5) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        vector = self.llm.embeddings(query_text)
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="userId",
                    match=MatchValue(value=user_id)
                )
            ]
        )
        try:
            results = self.client.search(
                collection_name=collection_name,
                query_vector=vector,
                query_filter=query_filter,
                limit=limit
            )
            return [r.payload for r in results]
        except Exception as e:
            print(f"Qdrant query failed: {e}")
            return []

    def get_latest_cognitive_profile(self, user_id: str = "demo-user") -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            results, _ = self.client.scroll(
                collection_name="cognitive_profile_collection",
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="userId",
                            match=MatchValue(value=user_id)
                        )
                    ]
                ),
                limit=1
            )
            if results:
                return results[0].payload
        except Exception as e:
            print(f"Qdrant load cognitive profile failed: {e}")
        return None
