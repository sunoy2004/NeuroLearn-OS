"""
Language detection and multilingual LLM instructions for lecture processing.
"""
import re
from typing import Optional

MULTILINGUAL_LLM_INSTRUCTION = """
MULTILINGUAL RULES (mandatory):
- Detect the primary language of the user's transcript or message.
- Write ALL generated content (summaries, notes, flashcards, quiz questions, explanations) in that SAME language.
- Support any language: English, Hindi, Bengali, French, Spanish, German, Tamil, Telugu, Arabic, etc.
- If the transcript mixes languages, use the dominant language for output.
- Keep JSON keys in English; only translate string values.
- Do not translate proper nouns or standard academic terms unless the lecture used a localized form.
"""

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

NOTES_LABELS = {
    "en": {"title": "Study Notes", "subject": "Subject", "words": "Word count", "concepts": "Key Concepts", "content": "Lecture Content", "revision": "Revision Guide"},
    "hi": {"title": "अध्ययन नोट्स", "subject": "विषय", "words": "शब्द संख्या", "concepts": "मुख्य अवधारणाएँ", "content": "व्याख्यान सामग्री", "revision": "पुनरावृत्ति मार्गदर्शिका"},
    "bn": {"title": "পাঠ নোট", "subject": "বিষয়", "words": "শব্দ সংখ্যা", "concepts": "মূল ধারণা", "content": "লেকচার বিষয়বস্তু", "revision": "পুনরালোচনা নির্দেশিকা"},
    "fr": {"title": "Notes d'étude", "subject": "Matière", "words": "Nombre de mots", "concepts": "Concepts clés", "content": "Contenu du cours", "revision": "Guide de révision"},
}


def _script_ratio(text: str, start: int, end: int) -> float:
    if not text:
        return 0.0
    count = sum(1 for c in text if start <= ord(c) <= end)
    return count / max(len(text), 1)


def detect_language(text: str) -> str:
    """Lightweight language detection from transcript text. Returns ISO 639-1 code."""
    if not text or not text.strip():
        return "en"

    sample = text.strip()[:4000]

    if _script_ratio(sample, 0x0900, 0x097F) > 0.08:
        return "hi"
    if _script_ratio(sample, 0x0980, 0x09FF) > 0.08:
        return "bn"
    if _script_ratio(sample, 0x0600, 0x06FF) > 0.08:
        return "ar"
    if _script_ratio(sample, 0x0400, 0x04FF) > 0.08:
        return "ru"
    if _script_ratio(sample, 0x4E00, 0x9FFF) > 0.08:
        return "zh"
    if _script_ratio(sample, 0x3040, 0x30FF) > 0.05:
        return "ja"
    if _script_ratio(sample, 0xAC00, 0xD7AF) > 0.08:
        return "ko"

    lower = sample.lower()
    french_markers = len(re.findall(r"\b(le|la|les|des|une|est|dans|pour|avec|qui|que|pas|plus|cette|ce|de|du)\b", lower))
    spanish_markers = len(re.findall(r"\b(el|la|los|las|un|una|es|en|de|que|por|con|para|como|más|este|esta)\b", lower))
    english_markers = len(re.findall(r"\b(the|and|is|are|was|were|this|that|with|for|from|have|has|not|you|we|they)\b", lower))

    if french_markers > max(english_markers, spanish_markers) + 2:
        return "fr"
    if spanish_markers > max(english_markers, french_markers) + 2:
        return "es"

    return "en"


def resolve_language(text: str, hint: Optional[str] = None) -> str:
    """Resolve language from optional BCP-47 hint or transcript detection."""
    if hint and hint.lower() not in ("auto", "", "unknown"):
        base = hint.split("-")[0].lower()
        if base in LANGUAGE_NAMES:
            return base
    return detect_language(text)


def language_display_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code, code.upper())


def notes_labels(lang: str) -> dict:
    return NOTES_LABELS.get(lang, NOTES_LABELS["en"])


def prompt_with_language(base_prompt: str, text: str, language_hint: Optional[str] = None) -> str:
    lang = resolve_language(text, language_hint)
    name = language_display_name(lang)
    return (
        f"{MULTILINGUAL_LLM_INSTRUCTION}\n"
        f"Detected/requested language: {name} ({lang}). "
        f"All output string values must be in {name}.\n\n"
        f"{base_prompt}"
    )
