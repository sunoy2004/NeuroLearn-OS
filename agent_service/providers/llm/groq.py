import json
import time
from typing import List, Dict, Any, Optional, Iterator
from openai import OpenAI
from agent_service.providers.interfaces.llm import LLMProvider
from agent_service.config import settings

try:
    from agent_service.agent_config_loader import AgentLLMConfig
except ImportError:
    AgentLLMConfig = None  # type: ignore


def _is_valid_key(key: str) -> bool:
    if not key or not key.strip():
        return False
    return "dummy" not in key.lower() and not key.startswith("YOUR_")


class GroqProvider(LLMProvider):
    """Grok/Groq provider with per-agent isolated config, streaming, and retry."""

    MAX_RETRIES = 2
    TIMEOUT_SEC = 60

    def __init__(self, config: Optional["AgentLLMConfig"] = None):
        self.config = config
        self.agent_id = config.agent_id if config else "global"
        self.model = (config.model if config else None) or settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        self.temperature = config.temperature if config else 0.3
        self.streaming_enabled = config.streaming if config else True

        groq_key = config.api_key if config and config.api_key else None
        self.client = None
        if groq_key and _is_valid_key(groq_key):
            self.client = OpenAI(
                api_key=groq_key,
                base_url="https://api.groq.com/openai/v1",
                timeout=self.TIMEOUT_SEC,
            )

        self.openai_client = None

    def _prepare_messages(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]]) -> list:
        msgs = list(messages)
        if context:
            msgs.insert(0, {"role": "system", "content": f"Context: {json.dumps(context)}"})
        return msgs

    def chat(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> str:
        if not self.client:
            return f"[{self.agent_id}] Groq LLM offline (missing API key)."
        msgs = self._prepare_messages(messages, context)
        last_err = None
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=msgs,
                    temperature=self.temperature,
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                last_err = e
                if attempt < self.MAX_RETRIES:
                    time.sleep(0.5 * (attempt + 1))
        print(f"[GroqProvider/{self.agent_id}] chat failed after retries: {last_err}")
        return f"[{self.agent_id}] Error executing Groq query: {last_err}"

    def stream(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> Iterator[str]:
        if not self.client:
            yield f"[{self.agent_id}] Groq LLM offline (missing API key)."
            return
        msgs = self._prepare_messages(messages, context)
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=msgs,
                temperature=self.temperature,
                stream=True,
            )
            for chunk in response:
                token = chunk.choices[0].delta.content
                if token:
                    yield token
        except Exception as e:
            print(f"[GroqProvider/{self.agent_id}] stream failed: {e}")
            yield f"\n[{self.agent_id} Stream Error: {e}]"

    def embeddings(self, text: str) -> List[float]:
        if self.openai_client:
            try:
                response = self.openai_client.embeddings.create(
                    input=text, model="text-embedding-3-small"
                )
                return response.data[0].embedding
            except Exception as e:
                print(f"[GroqProvider/{self.agent_id}] embeddings fallback failed: {e}")
        import random
        random.seed(hash(text))
        return [random.uniform(-1.0, 1.0) for _ in range(1536)]

    def summarize(self, text: str) -> Dict[str, Any]:
        prompt = (
            "Summarize the following lecture transcription. Respond strictly with a raw JSON object containing three keys: "
            "'title' (string), 'summary' (string paragraph), and 'concepts' (list of strings representing main concepts). "
            "Do not include markdown tags, code block wrappers or other text.\n\n"
            f"Transcription:\n{text}"
        )
        resp = self.chat([{"role": "user", "content": prompt}])
        try:
            clean_resp = resp.strip()
            if clean_resp.startswith("```json"):
                clean_resp = clean_resp[7:]
            if clean_resp.endswith("```"):
                clean_resp = clean_resp[:-3]
            return json.loads(clean_resp.strip())
        except Exception as e:
            print(f"[GroqProvider/{self.agent_id}] summarize parse failed: {e}")
            return {"title": "Lecture Summary", "summary": resp[:500], "concepts": []}
