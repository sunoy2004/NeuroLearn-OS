import os
import uuid
import time
import random
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from openai import OpenAI
from backend.config import settings

_qdrant_client: Optional[QdrantClient] = None
_qdrant_available = False
_qdrant_last_error: Optional[str] = None


def is_qdrant_available() -> bool:
    return _qdrant_available


def qdrant_status() -> Dict[str, Any]:
    return {
        "available": _qdrant_available,
        "url": settings.QDRANT_URL or "http://localhost:6333",
        "last_error": _qdrant_last_error,
    }


def get_qdrant_client() -> QdrantClient:
    """Lazily initializes and returns the Qdrant client."""
    global _qdrant_client, _qdrant_available, _qdrant_last_error

    if _qdrant_client is not None:
        return _qdrant_client

    url = (settings.QDRANT_URL or "").strip()
    on_render = os.getenv("RENDER") == "true"
    is_cloud = "qdrant.io" in url

    if url:
        try:
            kwargs: Dict[str, Any] = {"url": url, "timeout": 15}
            if settings.QDRANT_API_KEY:
                kwargs["api_key"] = settings.QDRANT_API_KEY
            client = QdrantClient(**kwargs)
            client.get_collections()
            _qdrant_client = client
            _qdrant_available = True
            _qdrant_last_error = None
            print(f"[Qdrant] Connected to {url}")
            return _qdrant_client
        except Exception as e:
            _qdrant_last_error = str(e)
            print(f"[Qdrant] Connection failed ({url}): {e}")
            if on_render or is_cloud:
                raise RuntimeError(f"Qdrant unavailable at {url}: {e}") from e

    local_url = url or "http://localhost:6333"
    try:
        client = QdrantClient(url=local_url, timeout=10)
        client.get_collections()
        _qdrant_client = client
        _qdrant_available = True
        _qdrant_last_error = None
        print(f"[Qdrant] Connected to {local_url}")
        return _qdrant_client
    except Exception as e:
        _qdrant_last_error = str(e)
        print(f"[Qdrant] Local server unavailable ({e}).")
        if on_render:
            raise RuntimeError("Qdrant not configured for Render deployment") from e
        print("[Qdrant] Using embedded local storage (dev only).")
        _qdrant_client = QdrantClient(path="db_qdrant")
        _qdrant_available = True
        return _qdrant_client


openai_client = None
if settings.OPENAI_API_KEY and "dummy" not in settings.OPENAI_API_KEY:
    openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

COLLECTIONS = [
    "lecture_memory_collection",
    "tutoring_memory_collection",
    "quiz_performance_collection",
    "cognitive_profile_collection",
    "voice_command_collection",
]


def get_embedding(text: str) -> List[float]:
    """Generates embedding vector with fallback for offline/testing setups."""
    if openai_client:
        try:
            response = openai_client.embeddings.create(
                input=text,
                model="text-embedding-3-small",
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"OpenAI embedding error: {e}. Falling back to pseudo-random vector.")

    h = hash(text)
    random.seed(h)
    return [random.uniform(-1.0, 1.0) for _ in range(1536)]


def initialize_qdrant():
    """Bootstraps all required Qdrant collections. Never blocks app startup on failure."""
    global _qdrant_available
    try:
        client = get_qdrant_client()
    except Exception as e:
        _qdrant_available = False
        print(f"[Qdrant] initialize skipped: {e}")
        return

    for collection in COLLECTIONS:
        try:
            exists = client.collection_exists(collection)
            if not exists:
                client.create_collection(
                    collection_name=collection,
                    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
                )
                print(f"Created Qdrant collection: {collection}")
        except Exception:
            try:
                client.get_collection(collection_name=collection)
            except Exception:
                try:
                    client.create_collection(
                        collection_name=collection,
                        vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
                    )
                    print(f"Created Qdrant collection (fallback): {collection}")
                except Exception as inner:
                    print(f"[Qdrant] Could not ensure collection {collection}: {inner}")


def store_memory(collection_name: str, payload: Dict[str, Any], text_to_embed: str) -> str:
    """Embeds text and upserts payload struct to a Qdrant collection."""
    try:
        client = get_qdrant_client()
    except Exception as e:
        print(f"[Qdrant] store_memory skipped — not connected: {e}")
        return ""

    try:
        point_id = str(uuid.uuid4())
        vector = get_embedding(text_to_embed)
        client.upsert(
            collection_name=collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            ],
        )
        return point_id
    except Exception as e:
        print(f"[Qdrant] store_memory failed: {e}")
        return ""


def search_memory(
    collection_name: str, query_text: str, user_id: str = "demo-user", limit: int = 5
) -> List[Dict[str, Any]]:
    """Performs a semantic vector search with metadata filtering for user context."""
    try:
        client = get_qdrant_client()
    except Exception as e:
        print(f"[Qdrant] search_memory skipped — not connected: {e}")
        return []

    try:
        vector = get_embedding(query_text)
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="userId",
                    match=MatchValue(value=user_id),
                )
            ]
        )
        results = client.search(
            collection_name=collection_name,
            query_vector=vector,
            query_filter=query_filter,
            limit=limit,
        )
        return [r.payload for r in results]
    except Exception as e:
        print(f"[Qdrant] search_memory failed: {e}")
        return []


def get_latest_cognitive_profile(user_id: str = "demo-user") -> Optional[Dict[str, Any]]:
    """Retrieves the most recent cognitive profile payload from vector memory."""
    try:
        client = get_qdrant_client()
    except Exception:
        return None

    try:
        results, _ = client.scroll(
            collection_name="cognitive_profile_collection",
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key="userId",
                        match=MatchValue(value=user_id),
                    )
                ]
            ),
            limit=1,
        )
        if results:
            return results[0].payload
    except Exception as e:
        print(f"Error scrolling cognitive profile: {e}")
    return None
