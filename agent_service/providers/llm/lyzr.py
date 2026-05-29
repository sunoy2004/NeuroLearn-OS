"""
Lyzr Studio LLM provider — per-agent API key + agent ID against prod inference API.
"""

import json
import time
import uuid
from typing import Any, Dict, Iterator, List, Optional

import httpx

from agent_service.config import settings
from agent_service.providers.interfaces.llm import LLMProvider

try:
    from agent_service.agent_config_loader import AgentLLMConfig
except ImportError:
    AgentLLMConfig = None  # type: ignore


class LyzrProvider(LLMProvider):
    """Calls Lyzr inference API using each agent's own key and Studio agent ID."""

    MAX_RETRIES = 2
    TIMEOUT_SEC = 90

    def __init__(self, config: Optional["AgentLLMConfig"] = None):
        self.config = config
        self.agent_id = config.agent_id if config else "lyzr"
        self.api_key = (config.api_key if config else "") or ""
        self.lyzr_agent_id = (config.lyzr_agent_id if config else "") or ""
        self.temperature = config.temperature if config else 0.3
        self.streaming_enabled = config.streaming if config else True
        self.base_url = settings.LYZR_BASE_URL.rstrip("/")

    def _is_configured(self) -> bool:
        return bool(
            self.api_key
            and self.lyzr_agent_id
            and "dummy" not in self.api_key.lower()
            and not self.api_key.startswith("YOUR_")
        )

    def _messages_to_prompt(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> str:
        parts: List[str] = []
        if context:
            parts.append(f"Context: {json.dumps(context)}")
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                parts.append(f"[System Instructions]\n{content}")
            elif role == "assistant":
                parts.append(f"[Assistant]\n{content}")
            else:
                parts.append(content)
        return "\n\n".join(p for p in parts if p.strip())

    def _extract_response_text(self, data: Any) -> str:
        if isinstance(data, str):
            return data.strip()
        if not isinstance(data, dict):
            return str(data)
        for key in ("response", "message", "content", "output", "text"):
            val = data.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
        return json.dumps(data)

    def _post_chat(self, message: str, session_id: Optional[str] = None) -> str:
        if not self._is_configured():
            return (
                f"[{self.agent_id}] Lyzr offline — set {self.agent_id.upper()}_AGENT_API_KEY "
                f"and {self.agent_id.upper()}_AGENT_LYZR_ID in .env."
            )

        url = f"{self.base_url}/v3/inference/chat/"
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "user_id": "neurolearn-user",
            "agent_id": self.lyzr_agent_id,
            "session_id": session_id or f"nl-{self.agent_id}-{uuid.uuid4().hex[:12]}",
            "message": message,
        }

        last_err: Optional[Exception] = None
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                with httpx.Client(timeout=self.TIMEOUT_SEC) as client:
                    resp = client.post(url, headers=headers, json=payload)
                    resp.raise_for_status()
                    return self._extract_response_text(resp.json())
            except Exception as e:
                last_err = e
                if attempt < self.MAX_RETRIES:
                    time.sleep(0.5 * (attempt + 1))

        print(f"[LyzrProvider/{self.agent_id}] chat failed: {last_err}")
        return f"[{self.agent_id}] Lyzr API error: {last_err}"

    def chat(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> str:
        prompt = self._messages_to_prompt(messages, context)
        return self._post_chat(prompt)

    def stream(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> Iterator[str]:
        text = self.chat(messages, context)
        words = text.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")

    def embeddings(self, text: str) -> List[float]:
        import random
        random.seed(hash(text))
        return [random.uniform(-1.0, 1.0) for _ in range(1536)]

    def summarize(self, text: str) -> Dict[str, Any]:
        prompt = (
            "Summarize the following lecture transcription. Respond strictly with a raw JSON object containing "
            "three keys: 'title' (string), 'summary' (string paragraph), and 'concepts' (list of strings). "
            "No markdown.\n\nTranscription:\n" + text
        )
        resp = self.chat([{"role": "user", "content": prompt}])
        try:
            clean = resp.strip()
            if clean.startswith("```json"):
                clean = clean[7:]
            if clean.startswith("```"):
                clean = clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            return json.loads(clean.strip())
        except Exception as e:
            print(f"[LyzrProvider/{self.agent_id}] summarize parse failed: {e}")
            return {"title": "Lecture Summary", "summary": resp[:500], "concepts": []}
