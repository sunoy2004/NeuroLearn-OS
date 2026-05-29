"""
IntentAgent — Classifies user transcripts into structured intent JSON.

Returns: {intent: str, confidence: float, entities: dict}
Confidence scoring is critical for the gating system — low-confidence
intents are rejected by the IntentValidator before any action is taken.
"""

from typing import Dict, Any, Optional
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

from agent_service.language_utils import MULTILINGUAL_INTENT_APPENDIX

INTENT_SYSTEM_PROMPT = """You are the Intent Classifier for an AI educational operating system called NeuroLearn OS.

Your ONLY job is to classify the user's spoken transcript into a structured JSON intent.

Respond ONLY with a raw JSON object (no markdown, no explanation). The JSON must have exactly these keys:
- "intent": one of the following strings:
    LECTURE_START, LECTURE_STOP, QUIZ_REQUEST, TUTORING_REQUEST,
    REVISION_START, ANALYTICS_QUERY, FLASHCARD_CREATE, ROADMAP_CREATE,
    GOAL_SET, WEAK_AREAS_QUERY, PROGRESS_QUERY, EXPLANATION_REQUEST,
    NAVIGATE_DASHBOARD, NAVIGATE_TUTOR, NAVIGATE_LECTURE, NAVIGATE_REVISION,
    NAVIGATE_ANALYTICS, NAVIGATE_GRAPH,
    GREETING, EDUCATIONAL_QUESTION, GENERAL_CONVERSATION,
    UNKNOWN
- "confidence": a float between 0.0 and 1.0 representing how certain you are
- "entities": a dict of extracted parameters (e.g. {"topic": "BCNF", "subject": "DBMS"})

Rules:
- If the transcript is empty, gibberish, or unclear, return intent "UNKNOWN" with confidence 0.0
- Navigation requests like "go to dashboard" or "open analytics" should use NAVIGATE_* intents
- "Explain X" or "What is X" should be EXPLANATION_REQUEST or TUTORING_REQUEST
- "Quiz me on X" or "Test me" should be QUIZ_REQUEST
- Greetings like "hello", "hi", "good morning", "how are you" should be GREETING with high confidence
- Educational questions like "teach me about X", "what is recursion" should be EDUCATIONAL_QUESTION
- General conversation like "thank you", "what can you do" should be GENERAL_CONVERSATION
- Be conservative with confidence — only give >0.8 for clear, unambiguous requests
- Moderately clear requests should get 0.6-0.8
- Vague or potentially misheard text should get <0.6
- Greetings and simple conversations should ALWAYS have confidence >= 0.8
""" + MULTILINGUAL_INTENT_APPENDIX


class IntentAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Intent Classifier Agent",
            system_prompt=INTENT_SYSTEM_PROMPT,
            llm=llm
        )

    def classify(self, transcript: str) -> Dict[str, Any]:
        """Classify a transcript and return structured intent data."""
        if not transcript or not transcript.strip():
            return {"intent": "UNKNOWN", "confidence": 0.0, "entities": {}}

        result = self.execute_json(transcript)

        # Ensure all required keys exist
        if "error" in result:
            return {"intent": "UNKNOWN", "confidence": 0.0, "entities": {}}

        return {
            "intent": result.get("intent", "UNKNOWN"),
            "confidence": float(result.get("confidence", 0.0)),
            "entities": result.get("entities", {})
        }
