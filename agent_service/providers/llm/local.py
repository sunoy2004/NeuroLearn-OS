import json
from typing import List, Dict, Any, Optional, Iterator
from agent_service.providers.interfaces.llm import LLMProvider

class LocalProvider(LLMProvider):
    def __init__(self, config=None):
        self.agent_id = config.agent_id if config else "local"
    def chat(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> str:
        prompt = messages[-1]["content"].lower() if messages else ""
        
        if "tree" in prompt or "b+" in prompt:
            return (
                "Think of B+ Trees like a multi-level index in a library. "
                "The guidebooks (internal nodes) direct you to the correct aisle and shelf, "
                "but the actual books (records/data pointers) are stored exclusively on the shelves (leaf nodes). "
                "Additionally, all the shelves are connected in a single straight path, allowing you to walk "
                "along them to scan multiple books (range scans) without having to climb up and down guidelines."
            )
        elif "normalize" in prompt or "normal form" in prompt:
            return (
                "Database Normalization is the process of organizing tables to minimize redundancy and avoid "
                "insert, update, and delete anomalies. For example, 1NF enforces atomic values, 2NF removes partial "
                "dependencies (where non-key columns depend on only part of a composite key), and 3NF removes "
                "transitive dependencies (where non-key columns depend on other non-key columns)."
            )
        elif "deadlock" in prompt:
            return (
                "A deadlock is a situation where two or more transactions are blocked forever, each waiting for "
                "the other to release a lock. The four Coffman conditions must hold: Mutual Exclusion, Hold and Wait, "
                "No Preemption, and Circular Wait. We prevent deadlocks by violating one of these conditions, "
                "for example, by ordering resource acquisitions globally."
            )
        elif "starvation" in prompt:
            return (
                "Starvation occurs when a process is perpetually denied necessary resources to make progress. "
                "Unlike deadlocks (where processes are active but stuck waiting on each other), a starved process "
                "is simply bypassed by scheduling systems favoring other processes (e.g. high-priority tasks in priority scheduling)."
            )
        return (
            f"This is a local, offline response from the local LLM simulator regarding: '{messages[-1]['content'] if messages else 'No prompt'}'. "
            "To activate full reasoning, set LLM_PROVIDER=groq or LLM_PROVIDER=openai with valid API keys in your .env file."
        )

    def stream(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> Iterator[str]:
        text = self.chat(messages, context)
        # Split into small parts to simulate token-by-token streaming
        words = text.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")

    def embeddings(self, text: str) -> List[float]:
        import random
        random.seed(hash(text))
        return [random.uniform(-1.0, 1.0) for _ in range(1536)]

    def summarize(self, text: str) -> Dict[str, Any]:
        return {
            "title": "Local Mock Summary - DB Indexing",
            "summary": "This is a programmatic local summary of the audio transcript. Indexing allows the database engine to search tables without full table scans.",
            "concepts": ["Indexes", "B+ Trees", "Seek time", "Scan time"]
        }
