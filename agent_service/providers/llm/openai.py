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


class OpenAIProvider(LLMProvider):
    MAX_RETRIES = 2

    def __init__(self, config: Optional["AgentLLMConfig"] = None):
        self.config = config
        self.agent_id = config.agent_id if config else "global"
        self.model = (config.model if config else None) or "gpt-4o-mini"
        self.temperature = config.temperature if config else 0.3

        api_key = config.api_key if config and config.api_key else None
        api_key = api_key if api_key and "dummy" not in api_key.lower() and not api_key.startswith("YOUR_") else None
        self.client = OpenAI(api_key=api_key, timeout=60) if api_key else None

    def chat(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> str:
        if not self.client:
            return f"[{self.agent_id}] OpenAI offline (missing API key)."
        msgs = list(messages)
        if context:
            msgs.insert(0, {"role": "system", "content": f"Context: {json.dumps(context)}"})
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                response = self.client.chat.completions.create(
                    model=self.model, messages=msgs, temperature=self.temperature
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                if attempt >= self.MAX_RETRIES:
                    return f"[{self.agent_id}] OpenAI error: {e}"
                time.sleep(0.5)
        return f"[{self.agent_id}] OpenAI error"

    def stream(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> Iterator[str]:
        if not self.client:
            yield f"[{self.agent_id}] OpenAI offline."
            return
        msgs = list(messages)
        if context:
            msgs.insert(0, {"role": "system", "content": f"Context: {json.dumps(context)}"})
        try:
            response = self.client.chat.completions.create(
                model=self.model, messages=msgs, temperature=self.temperature, stream=True
            )
            for chunk in response:
                token = chunk.choices[0].delta.content
                if token:
                    yield token
        except Exception as e:
            yield f"\n[{self.agent_id} Stream Error: {e}]"

    def embeddings(self, text: str) -> List[float]:
        if not self.client:
            import random
            random.seed(hash(text))
            return [random.uniform(-1.0, 1.0) for _ in range(1536)]
        try:
            response = self.client.embeddings.create(input=text, model="text-embedding-3-small")
            return response.data[0].embedding
        except Exception:
            import random
            random.seed(hash(text))
            return [random.uniform(-1.0, 1.0) for _ in range(1536)]

    def summarize(self, text: str) -> Dict[str, Any]:
        prompt = (
            "Summarize the following lecture transcription. Respond with JSON: "
            '{"title": string, "summary": string, "concepts": string[]}\n\n'
            f"Transcription:\n{text}"
        )
        resp = self.chat([{"role": "user", "content": prompt}])
        try:
            clean = resp.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(clean)
        except Exception:
            return {"title": "Summary", "summary": resp[:500], "concepts": []}
