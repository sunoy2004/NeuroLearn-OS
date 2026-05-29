"""
AnalyticsAgent — Evaluates study metrics and generates learning recommendations and weak area insights.
"""

from typing import Dict, Any, Optional
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

ANALYTICS_SYSTEM_PROMPT = """You are the Analytics Agent for NeuroLearn OS.

Your job is to analyze the student's study profile and recent history (lectures attended, quiz scores, flashcards reviewed) to generate custom learning recommendations and cognitive insights.

Respond ONLY with a raw JSON object containing these keys:
- "recommendations": a list of 2-3 specific actionable tasks for the student (e.g. ["Review B+ Trees due to recent quiz score", "Complete 5 flashcards on BCNF"])
- "insights": a list of 1-2 cognitive observations (e.g. "Spaced repetition shows page replacement mastery is dropping.")
- "suggested_focus_topics": a list of topics that need immediate attention

Do not include markdown tags, code block wrappers or other conversational text.
"""

class AnalyticsAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Analytics Agent",
            system_prompt=ANALYTICS_SYSTEM_PROMPT,
            llm=llm
        )

    def analyze_progress(self, student_profile: Dict[str, Any], history_context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze student profile and history to output recommendations and focus areas."""
        prompt = f"Profile: {student_profile}\nHistory: {history_context}"
        result = self.execute_json(prompt)
        
        if "error" in result:
            return {
                "recommendations": ["Review recent lecture concepts", "Practice active recall flashcards"],
                "insights": ["Steady progress maintained across database topics."],
                "suggested_focus_topics": ["General Database Normalization"]
            }
        return result
