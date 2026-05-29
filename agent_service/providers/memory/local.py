import os
import sqlite3
import json
import uuid
import time
from typing import List, Dict, Any, Optional
from agent_service.providers.interfaces.memory import MemoryProvider

class LocalMemoryProvider(MemoryProvider):
    def __init__(self, llm_provider, db_path: str = "agent_service/local_memory.db"):
        self.llm = llm_provider
        self.db_path = db_path
        self.initialize()

    def _get_connection(self):
        # Establish connection with thread safety flags
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def initialize(self) -> None:
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS local_memories (
                    id TEXT PRIMARY KEY,
                    collection TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    vector TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    timestamp REAL NOT NULL
                )
            """)
            conn.commit()
        except Exception as e:
            print(f"Failed to initialize SQLite local memory table: {e}")
        finally:
            conn.close()

    def store_memory(self, collection_name: str, payload: Dict[str, Any], text_to_embed: str) -> str:
        point_id = str(uuid.uuid4())
        vector = self.llm.embeddings(text_to_embed)
        user_id = payload.get("userId", "demo-user")
        
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO local_memories (id, collection, user_id, vector, payload, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    point_id,
                    collection_name,
                    user_id,
                    json.dumps(vector),
                    json.dumps(payload),
                    time.time()
                )
            )
            conn.commit()
            return point_id
        except Exception as e:
            print(f"SQLite store memory error: {e}")
            return ""
        finally:
            conn.close()

    def search_memory(self, collection_name: str, query_text: str, user_id: str = "demo-user", limit: int = 5) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT vector, payload FROM local_memories WHERE collection = ? AND user_id = ?",
                (collection_name, user_id)
            )
            rows = cursor.fetchall()
            if not rows:
                return []

            query_vector = self.llm.embeddings(query_text)
            
            # Compute cosine similarity locally in Python
            scored_memories = []
            for r in rows:
                try:
                    stored_vector = json.loads(r["vector"])
                    payload = json.loads(r["payload"])
                    
                    # Cosine similarity logic
                    dot_product = sum(a*b for a, b in zip(query_vector, stored_vector))
                    norm_q = sum(a*a for a in query_vector) ** 0.5
                    norm_s = sum(a*a for a in stored_vector) ** 0.5
                    
                    score = dot_product / (norm_q * norm_s) if (norm_q > 0 and norm_s > 0) else 0.0
                    scored_memories.append((score, payload))
                except Exception as parse_err:
                    print(f"Local memory parse error: {parse_err}")
            
            # Sort by similarity score descending
            scored_memories.sort(key=lambda x: x[0], reverse=True)
            return [payload for score, payload in scored_memories[:limit]]
        except Exception as e:
            print(f"SQLite search memory error: {e}")
            return []
        finally:
            conn.close()

    def get_latest_cognitive_profile(self, user_id: str = "demo-user") -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT payload FROM local_memories WHERE collection = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 1",
                ("cognitive_profile_collection", user_id)
            )
            row = cursor.fetchone()
            if row:
                return json.loads(row["payload"])
        except Exception as e:
            print(f"SQLite load profile error: {e}")
        finally:
            conn.close()
        return None
