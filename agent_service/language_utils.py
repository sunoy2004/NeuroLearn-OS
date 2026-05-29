"""Multilingual support for agent service — shared rules and detection."""
from typing import Optional

# Re-use backend logic via duplicated constants (services are separate packages)
MULTILINGUAL_SYSTEM_APPENDIX = """
MULTILINGUAL RULES (mandatory):
- Understand user input in ANY language (English, Hindi, Bengali, French, Spanish, etc.).
- Detect the primary language of the user's message or transcript.
- Respond and generate ALL content in that SAME language unless the user explicitly asks for another language.
- For voice commands and intents: classify intent regardless of input language; extract entities in their original form.
- For lecture notes, summaries, flashcards, and quizzes: use the lecture's language, not English by default.
- JSON keys stay in English; translate only string values.
"""

MULTILINGUAL_INTENT_APPENDIX = """
- The user may speak in Hindi, Bengali, French, or any other language — still map to the correct intent enum.
- Examples: "मुझे क्विज दो" → QUIZ_REQUEST; "explique-moi BCNF" → EXPLANATION_REQUEST; "ড্যাশবোর্ড খুলো" → NAVIGATE_DASHBOARD.
"""


def detect_language(text: str) -> str:
    if not text or not text.strip():
        return "en"
    sample = text.strip()[:4000]
    devanagari = sum(1 for c in sample if "\u0900" <= c <= "\u097f")
    bengali = sum(1 for c in sample if "\u0980" <= c <= "\u09ff")
    n = max(len(sample), 1)
    if devanagari / n > 0.08:
        return "hi"
    if bengali / n > 0.08:
        return "bn"
    return "en"
