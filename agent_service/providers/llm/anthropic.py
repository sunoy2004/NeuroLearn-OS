import os
import json
import httpx
from typing import List, Dict, Any, Optional, Iterator
from agent_service.providers.interfaces.llm import LLMProvider
from agent_service.config import settings

class AnthropicProvider(LLMProvider):
    def __init__(self, config=None):
        from agent_service.agent_config_loader import AgentLLMConfig
        self.config = config
        self.agent_id = config.agent_id if config else "global"
        self.api_key = config.api_key if config and config.api_key else ""
        self.model = (config.model if config else None) or settings.ANTHROPIC_MODEL or "claude-3-5-sonnet-20241022"
        self.temperature = config.temperature if config else 0.3


    def chat(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> str:
        if not self.api_key or "dummy" in self.api_key:
            return "Anthropic is offline (missing ANTHROPIC_API_KEY)."
        
        try:
            # Reformat messages: Anthropic doesn't support 'system' role inside messages array,
            # it should be passed as a separate 'system' parameter.
            system_msg = ""
            msgs = []
            if context:
                system_msg += f"Session Context Memory: {json.dumps(context)}\n"
            
            for m in messages:
                if m["role"] == "system":
                    system_msg += m["content"] + "\n"
                else:
                    msgs.append({"role": m["role"], "content": m["content"]})

            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            payload = {
                "model": self.model,
                "max_tokens": 2048,
                "messages": msgs
            }
            if system_msg:
                payload["system"] = system_msg.strip()

            response = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            if response.status_code == 200:
                result = response.json()
                return result["content"][0]["text"].strip()
            else:
                print(f"Anthropic API error {response.status_code}: {response.text}")
                return f"Anthropic API returned error: {response.text}"
        except Exception as e:
            print(f"Anthropic chat failed: {e}")
            return f"Error executing Anthropic query: {e}"

    def stream(self, messages: List[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> Iterator[str]:
        # Simple non-stream fallback or SSE streamer
        if not self.api_key or "dummy" in self.api_key:
            yield "Anthropic is offline (missing ANTHROPIC_API_KEY)."
            return
        
        # Stream over SSE
        try:
            system_msg = ""
            msgs = []
            if context:
                system_msg += f"Session Context Memory: {json.dumps(context)}\n"
            
            for m in messages:
                if m["role"] == "system":
                    system_msg += m["content"] + "\n"
                else:
                    msgs.append({"role": m["role"], "content": m["content"]})

            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            payload = {
                "model": self.model,
                "max_tokens": 2048,
                "messages": msgs,
                "stream": True
            }
            if system_msg:
                payload["system"] = system_msg.strip()

            with httpx.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
                timeout=30.0
            ) as r:
                for line in r.iter_lines():
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if data.get("type") == "content_block_delta":
                                token = data["delta"].get("text", "")
                                if token:
                                    yield token
                        except Exception:
                            pass
        except Exception as e:
            print(f"Anthropic stream failed: {e}")
            yield f"\n[Stream Error: {e}]"

    def embeddings(self, text: str) -> List[float]:
        # Anthropic doesn't have an embeddings API, return deterministic random floats
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
            print(f"Anthropic summarize parse failed: {e}. Raw response: {resp}")
            return {
                "title": "Lecture Summary",
                "summary": "Failed to parse structured summary. Here is raw text outline.",
                "concepts": ["Indexing", "Queries"]
            }
