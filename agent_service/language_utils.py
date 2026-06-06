"""Multilingual support for agent service — shared rules and detection."""
from typing import Optional, Tuple, Dict, Any

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "bn": "Bengali",
    "fr": "French",
    "es": "Spanish",
    "de": "German",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ar": "Arabic",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "pt": "Portuguese",
    "ru": "Russian",
}

MULTILINGUAL_SYSTEM_APPENDIX = """
MULTILINGUAL RULES (mandatory):
- When an output language is specified in session context, use ONLY that language for all generated text.
- Never mix languages in one lecture (no English + French, no Hindi + English).
- JSON keys stay in English; translate only string values.
- Section headings, titles, summaries, notes, flashcards, and quiz text must all match the lecture language.
"""

MULTILINGUAL_INTENT_APPENDIX = """
- The user may speak in Hindi, Bengali, French, or any other language — still map to the correct intent enum.
- Examples: "मुझे क्विज दो" → QUIZ_REQUEST; "explique-moi BCNF" → EXPLANATION_REQUEST; "ড্যাশবোর্ড খুলো" → NAVIGATE_DASHBOARD.
"""


def language_display_name(code: str) -> str:
    return LANGUAGE_NAMES.get((code or "en").split("-")[0].lower(), (code or "en").upper())


def apply_language_lock(
    prompt: str, language: Optional[str] = None
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Prefix a user prompt and build session context for strict single-language output."""
    if not language:
        return prompt, None
    base = language.split("-")[0].lower()
    name = language_display_name(base)
    ctx: Dict[str, Any] = {
        "output_language": base,
        "output_language_name": name,
        "strict_monolingual": True,
    }
    locked = (
        f"STRICT LANGUAGE RULE: Write ALL output text exclusively in {name} ({base}). "
        f"Do NOT use English, French, or any other language. "
        f"Translate markdown headings into {name} as well.\n\n"
        f"{prompt}"
    )
    return locked, ctx


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
