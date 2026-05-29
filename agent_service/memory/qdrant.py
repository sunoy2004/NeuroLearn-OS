import uuid
import time
import random
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from openai import OpenAI
from agent_service.config import settings

_qdrant_client = None
_openai_client = None

def get_qdrant_client() -> QdrantClient:
    """Lazily initializes Qdrant client to avoid lock collisions."""
    global _qdrant_client
    if _qdrant_client is None:
        if settings.QDRANT_URL:
            try:
                _qdrant_client = QdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)
            except Exception as e:
                print(f"Error connecting to Qdrant Cloud at {settings.QDRANT_URL}: {e}. Falling back to local storage.")
                _qdrant_client = QdrantClient(path="db_qdrant")
        else:
            _qdrant_client = QdrantClient(path="db_qdrant")
    return _qdrant_client

def get_openai_client() -> Optional[OpenAI]:
    global _openai_client
    if _openai_client is None:
        if settings.OPENAI_API_KEY and "dummy" not in settings.OPENAI_API_KEY:
            _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client

COLLECTIONS = [
    "lecture_memory_collection",
    "tutoring_memory_collection",
    "quiz_performance_collection",
    "cognitive_profile_collection",
    "voice_command_collection"
]

def get_embedding(text: str) -> List[float]:
    """Generates embeddings, falling back to pseudo-random embeddings for offline testing."""
    client = get_openai_client()
    if client:
        try:
            response = client.embeddings.create(
                input=text,
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"OpenAI embedding generation failed: {e}. Falling back to random.")
            
    # Deterministic fallback vectors
    random.seed(hash(text))
    return [random.uniform(-1.0, 1.0) for _ in range(1536)]

def initialize_qdrant():
    """Bootstraps necessary Qdrant collections."""
    client = get_qdrant_client()
    for col in COLLECTIONS:
        try:
            if not client.collection_exists(col):
                client.create_collection(
                    collection_name=col,
                    vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
                )
                print(f"Created Qdrant Vector Collection: {col}")
        except Exception as e:
            try:
                client.get_collection(collection_name=col)
            except Exception:
                client.create_collection(
                    collection_name=col,
                    vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
                )
                print(f"Created Qdrant Vector Collection (fallback): {col}")

def store_memory(collection_name: str, payload: Dict[str, Any], text_to_embed: str) -> str:
    """Stores a semantic point in vector memory."""
    client = get_qdrant_client()
    point_id = str(uuid.uuid4())
    vector = get_embedding(text_to_embed)
    
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
    """Retrieves relevant semantic memories for a context."""
    client = get_qdrant_client()
    vector = get_embedding(query_text)
    
    query_filter = Filter(
        must=[
            FieldCondition(
                key="userId",
                match=MatchValue(value=user_id)
            )
        ]
    )
    
    try:
        results = client.search(
            collection_name=collection_name,
            query_vector=vector,
            query_filter=query_filter,
            limit=limit
        )
        return [r.payload for r in results]
    except Exception as e:
        print(f"Qdrant vector search failed: {e}")
        return []

def get_latest_cognitive_profile(user_id: str = "demo-user") -> Optional[Dict[str, Any]]:
    client = get_qdrant_client()
    try:
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
        print(f"Failed loading cognitive profile: {e}")
    return None
