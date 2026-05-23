import uuid
import time
import random
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from openai import OpenAI
from backend.config import settings

_qdrant_client = None

def get_qdrant_client() -> QdrantClient:
    """Lazily initializes and returns the Qdrant client to avoid multi-process lock errors."""
    global _qdrant_client
    if _qdrant_client is None:
        if settings.QDRANT_URL:
            try:
                _qdrant_client = QdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)
            except Exception as e:
                print(f"Error connecting to Qdrant server at {settings.QDRANT_URL}: {e}. Falling back to local storage.")
                _qdrant_client = QdrantClient(path="db_qdrant")
        else:
            _qdrant_client = QdrantClient(path="db_qdrant")
    return _qdrant_client


openai_client = None
if settings.OPENAI_API_KEY and "dummy" not in settings.OPENAI_API_KEY:
    openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

COLLECTIONS = [
    "lecture_memory_collection",
    "tutoring_memory_collection",
    "quiz_performance_collection",
    "cognitive_profile_collection",
    "voice_command_collection"
]

def get_embedding(text: str) -> List[float]:
    """Generates embedding vector with fallback for offline/testing setups."""
    if openai_client:
        try:
            response = openai_client.embeddings.create(
                input=text,
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"OpenAI embedding error: {e}. Falling back to pseudo-random vector.")
            
    # Pseudo-random fallback vector (seeded by text to remain deterministic)
    h = hash(text)
    random.seed(h)
    return [random.uniform(-1.0, 1.0) for _ in range(1536)]

def initialize_qdrant():
    """Bootstraps all required Qdrant collections."""
    client = get_qdrant_client()
    for collection in COLLECTIONS:
        try:
            exists = client.collection_exists(collection)
            if not exists:
                client.create_collection(
                    collection_name=collection,
                    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
                )
                print(f"Created Qdrant collection: {collection}")
        except Exception as e:
            # Older qdrant client fallback
            try:
                client.get_collection(collection_name=collection)
            except Exception:
                client.create_collection(
                    collection_name=collection,
                    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
                )
                print(f"Created Qdrant collection (fallback): {collection}")


def store_memory(collection_name: str, payload: Dict[str, Any], text_to_embed: str) -> str:
    """Embeds text and upserts payload struct to a Qdrant collection."""
    point_id = str(uuid.uuid4())
    vector = get_embedding(text_to_embed)
    client = get_qdrant_client()
    
    client.upsert(
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

def search_memory(collection_name: str, query_text: str, user_id: str = "demo-user", limit: int = 5) -> List[Dict[str, Any]]:
    """Performs a semantic vector search with metadata filtering for user context."""
    vector = get_embedding(query_text)
    
    # Filter results by userId
    query_filter = Filter(
        must=[
            FieldCondition(
                key="userId",
                match=MatchValue(value=user_id)
            )
        ]
    )
    
    client = get_qdrant_client()
    results = client.search(
        collection_name=collection_name,
        query_vector=vector,
        query_filter=query_filter,
        limit=limit
    )
    
    return [r.payload for r in results]

def get_latest_cognitive_profile(user_id: str = "demo-user") -> Optional[Dict[str, Any]]:
    """Retrieves the most recent cognitive profile payload from vector memory."""
    try:
        client = get_qdrant_client()
        results, _ = client.scroll(
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
        print(f"Error scrolling cognitive profile: {e}")
    return None
