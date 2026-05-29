"""
SpecialistAgent — Provider-agnostic base class for all domain-specific agents.

Each specialist agent receives an injected LLM provider (Groq, OpenAI, Anthropic, Local)
and a system prompt that defines its behavioral scope. No mock fallbacks — if the LLM
is offline, a clear error is returned.
"""

import json
from typing import Dict, Any, Optional, List
from agent_service.providers.interfaces.llm import LLMProvider
from agent_service.language_utils import MULTILINGUAL_SYSTEM_APPENDIX


class SpecialistAgent:
    """Base class for all specialist agents in the distributed architecture."""

    def __init__(self, name: str, system_prompt: str, llm: LLMProvider):
        self.name = name
        self.system_prompt = system_prompt
        self.llm = llm

    def execute(self, user_prompt: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Execute the agent's reasoning pipeline using the injected LLM provider."""
        system_content = f"{self.system_prompt}\n\n{MULTILINGUAL_SYSTEM_APPENDIX}"
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_content}
        ]
        if context:
            messages.append({
                "role": "system",
                "content": f"Session Context Memory: {json.dumps(context)}"
            })
        messages.append({"role": "user", "content": user_prompt})

        try:
            response = self.llm.chat(messages=messages, context=None)
            return response
        except Exception as e:
            error_msg = f"[{self.name}] LLM execution failed: {e}"
            print(error_msg)
            return error_msg

    def execute_json(self, user_prompt: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute and parse the response as JSON. Returns a dict or a fallback error dict."""
        raw = self.execute(user_prompt, context)
        try:
            clean = raw.strip()
            if clean.startswith("```json"):
                clean = clean[7:]
            if clean.startswith("```"):
                clean = clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            return json.loads(clean.strip())
        except (json.JSONDecodeError, Exception) as e:
            print(f"[{self.name}] JSON parse failed: {e}. Raw response: {raw[:200]}")
            return {"error": str(e), "raw": raw[:500]}

    def stream(self, user_prompt: str, context: Optional[Dict[str, Any]] = None):
        """Stream token-by-token from the agent's isolated LLM provider."""
        system_content = f"{self.system_prompt}\n\n{MULTILINGUAL_SYSTEM_APPENDIX}"
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_content}
        ]
        if context:
            messages.append({
                "role": "system",
                "content": f"Session Context Memory: {json.dumps(context)}"
            })
        messages.append({"role": "user", "content": user_prompt})
        try:
            yield from self.llm.stream(messages=messages, context=None)
        except Exception as e:
            yield f"[{self.name}] Stream failed: {e}"
