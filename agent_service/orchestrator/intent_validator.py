"""
IntentValidator — Confidence-based gating system for intent classification.

This is the critical gate that prevents hallucinated auto-redirects.
If confidence is below threshold, the system does NOTHING — no navigation,
no fallback to AI Tutor, no default behavior.

Conversational intents (greetings, educational questions) are low-impact
and use a lower confidence threshold.
"""

from typing import Tuple, Dict, Any

# Minimum confidence threshold for accepting an intent
CONFIDENCE_THRESHOLD = 0.6

# Lower threshold for conversational intents (no side effects)
CONVERSATIONAL_CONFIDENCE_THRESHOLD = 0.4

# Intents that require navigation (and could cause unwanted redirects)
NAVIGATION_INTENTS = {
    "NAVIGATE_DASHBOARD", "NAVIGATE_TUTOR", "NAVIGATE_LECTURE",
    "NAVIGATE_REVISION", "NAVIGATE_ANALYTICS", "NAVIGATE_GRAPH",
    "QUIZ_REQUEST", "REVISION_START", "ANALYTICS_QUERY",
    "PROGRESS_QUERY", "WEAK_AREAS_QUERY"
}

# Intents that trigger side effects (recording, etc.)
SIDE_EFFECT_INTENTS = {
    "LECTURE_START", "LECTURE_STOP", "FLASHCARD_CREATE",
    "ROADMAP_CREATE", "GOAL_SET"
}

# Conversational intents — low impact, safe to act on with lower confidence
CONVERSATIONAL_INTENTS = {
    "GREETING", "EDUCATIONAL_QUESTION", "GENERAL_CONVERSATION",
    "EXPLANATION_REQUEST", "TUTORING_REQUEST"
}


def validate_intent(intent_data: Dict[str, Any], transcript: str = "") -> Tuple[bool, str]:
    """
    Validate whether an intent should be acted upon.
    
    Returns:
        (is_valid, reason) — if is_valid is False, the system should
        respond with the reason string and take NO action.
    """
    intent = intent_data.get("intent", "UNKNOWN")
    confidence = float(intent_data.get("confidence", 0.0))

    # Rule 1: Empty or whitespace-only transcript → reject
    if not transcript or not transcript.strip():
        return False, "I didn't detect any speech. Please try again."

    # Rule 2: UNKNOWN intent → reject
    if intent == "UNKNOWN":
        return False, "I didn't understand that request. Could you rephrase it?"

    # Rule 3a: Conversational intents have lower threshold
    if intent in CONVERSATIONAL_INTENTS:
        if confidence < CONVERSATIONAL_CONFIDENCE_THRESHOLD:
            return False, (
                f"I'm not confident enough in what I heard (confidence: {confidence:.0%}). "
                "Could you repeat that more clearly?"
            )
        return True, "OK"

    # Rule 3b: Standard confidence threshold for action intents
    if confidence < CONFIDENCE_THRESHOLD:
        return False, (
            f"I'm not confident enough in what I heard (confidence: {confidence:.0%}). "
            "Could you repeat that more clearly?"
        )

    # Rule 4: Very short transcript with high-impact intents → extra scrutiny
    if len(transcript.strip()) < 3 and intent in (NAVIGATION_INTENTS | SIDE_EFFECT_INTENTS):
        return False, "That was too brief for me to act on. Could you say that again?"

    # Rule 5: Side-effect intents need higher confidence
    if intent in SIDE_EFFECT_INTENTS and confidence < 0.7:
        return False, (
            f"I think you might want to {intent.lower().replace('_', ' ')}, "
            f"but I'm not sure enough (confidence: {confidence:.0%}). Could you confirm?"
        )

    # All checks passed — intent is valid
    return True, "OK"
