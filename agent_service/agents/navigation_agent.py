"""
NavigationAgent — Parses navigation intents and returns structured action JSON.

Validates target pages against known routes in the NeuroLearn OS frontend.
"""

from typing import Dict, Any, Optional
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

# Known valid pages in the frontend
VALID_PAGES = {
    "dashboard", "lecture-studio", "tutor", "knowledge-graph",
    "revision", "analytics", "voice"
}

NAVIGATION_SYSTEM_PROMPT = """You are the Navigation Agent for NeuroLearn OS.

Your role is to parse user requests to navigate the system and identify the correct target page.

Valid target pages are:
- "dashboard" — main overview page
- "lecture-studio" — lecture recording and transcription workspace
- "tutor" — AI tutor conversation interface
- "knowledge-graph" — concept relationship visualization
- "revision" — flashcards, quizzes, and spaced repetition
- "analytics" — learning statistics and cognitive profiles

Respond ONLY with a raw JSON object:
{"action": "navigate", "target": "<page_name>"}

If the request is not a navigation request, respond:
{"action": "none", "target": ""}
"""


class NavigationAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Navigation Agent",
            system_prompt=NAVIGATION_SYSTEM_PROMPT,
            llm=llm
        )

    def resolve_target(self, transcript: str) -> Dict[str, str]:
        """Resolve a navigation request to a valid page target."""
        result = self.execute_json(transcript)

        if "error" in result:
            return {"action": "none", "target": ""}

        target = result.get("target", "").strip().lower()

        # Validate against known pages
        if target not in VALID_PAGES:
            # Try fuzzy matching
            if "tutor" in target or "explain" in target:
                target = "tutor"
            elif "lecture" in target or "record" in target:
                target = "lecture-studio"
            elif "revision" in target or "quiz" in target or "flashcard" in target:
                target = "revision"
            elif "analytic" in target or "stats" in target or "progress" in target:
                target = "analytics"
            elif "graph" in target or "network" in target or "concept" in target:
                target = "knowledge-graph"
            else:
                target = "dashboard"

        return {"action": "navigate", "target": target}
