"""
Lyzr-powered lecture content pipeline — summary, notes, flashcards, quiz.
Falls back to heuristics when Lyzr is unavailable or returns invalid JSON.
"""
import json
from typing import Any, Dict, List, Optional, Tuple

from concept_keywords import extract_concepts_from_text
from backend.services.lyzr_client import get_agent_lyzr_credentials, is_lyzr_configured, lyzr_agent_execute
from backend.services.content_extractor import (
    _clean_json,
    generate_summary_heuristic,
    generate_flashcards_heuristic,
    generate_quiz_heuristic,
    generate_notes_heuristic,
    extract_concepts_from_transcript,
)
from backend.services.language_utils import resolve_language


def is_lyzr_lecture_pipeline_available() -> bool:
    key, aid = get_agent_lyzr_credentials("LECTURE")
    return is_lyzr_configured(key, aid)


def _parse_json_response(raw: str, fallback: Any) -> Any:
    try:
        return json.loads(_clean_json(raw))
    except Exception:
        return fallback


def process_transcript_with_lyzr(
    transcript: str,
    title: str,
    subject: str,
    language_hint: Optional[str] = None,
) -> Tuple[Dict, List, List, str]:
    """
    Process a lecture transcript through Lyzr specialist agents.
    Returns (summary_data, flashcards_data, quiz_data, raw_notes).
    """
    lang = resolve_language(transcript, language_hint)
    heuristic_summary = generate_summary_heuristic(transcript, title)
    heuristic_concepts = extract_concepts_from_text(transcript) or extract_concepts_from_transcript(transcript)

    summary_prompt = (
        "Analyze this lecture transcript thoroughly. Respond with JSON only (no markdown):\n"
        '{"title": string, "summary": string (2-4 paragraphs covering all key topics discussed), '
        '"concepts": string[] (5-10 key academic concepts/topics covered)}\n\n'
        f"Subject: {subject}\nTranscript:\n{transcript[:8000]}"
    )
    summary_raw = lyzr_agent_execute(
        "LECTURE",
        "Lecture Processing Agent",
        "You extract lecture topics, summaries, and key concepts as structured JSON.",
        summary_prompt,
    )
    summary_data = _parse_json_response(summary_raw, heuristic_summary)
    if not isinstance(summary_data, dict):
        summary_data = heuristic_summary

    concepts = summary_data.get("concepts") or []
    if not isinstance(concepts, list):
        concepts = []
    concepts = [c for c in concepts if isinstance(c, str) and len(c.strip()) > 1]
    if not concepts:
        concepts = heuristic_concepts
    if not concepts:
        concepts = heuristic_concepts or [title.split(" - ")[0].strip()] if title else []
    summary_data["concepts"] = concepts
    if not summary_data.get("summary"):
        summary_data["summary"] = heuristic_summary.get("summary", "")
    if not summary_data.get("title"):
        summary_data["title"] = title

    notes_prompt = (
        "Generate detailed Markdown study notes from this lecture transcript.\n"
        "Include: ## Overview, ## Key Concepts (with bullet explanations for each), "
        "## Important Details, ## Review Questions.\n"
        "Use the same language as the transcript. No code fences.\n\n"
        f"Concepts: {', '.join(concepts)}\nSubject: {subject}\n\nTranscript:\n{transcript[:6000]}"
    )
    try:
        notes_raw = lyzr_agent_execute(
            "NOTES",
            "Notes Agent",
            "You generate comprehensive Markdown study notes from lecture transcripts.",
            notes_prompt,
        )
        raw_notes = notes_raw.strip() if notes_raw and not notes_raw.strip().startswith("{") else ""
    except Exception:
        raw_notes = ""
    if not raw_notes or len(raw_notes) < 50:
        raw_notes = generate_notes_heuristic(transcript, concepts, title, subject, lang)

    fc_prompt = (
        "Generate 5-8 high-quality flashcards as a JSON array only:\n"
        '[{"front": string, "back": string, "topic": string}]\n'
        "Each card should test understanding of a specific concept from the lecture.\n\n"
        f"Concepts: {concepts}\nTranscript excerpt:\n{transcript[:4000]}"
    )
    try:
        fc_raw = lyzr_agent_execute(
            "FLASHCARD",
            "Flashcard Agent",
            "You generate educational flashcards as JSON arrays.",
            fc_prompt,
        )
        flashcards_data = _parse_json_response(fc_raw, [])
        if not isinstance(flashcards_data, list):
            flashcards_data = []
    except Exception:
        flashcards_data = []
    if not flashcards_data:
        flashcards_data = generate_flashcards_heuristic(transcript, concepts, lang)

    quiz_prompt = (
        "Generate 3-5 multiple-choice quiz questions as a JSON array only:\n"
        '[{"question": string, "options": string[4], "correct": int, "explanation": string, "topic": string}]\n'
        f"Concepts: {concepts}\nTranscript excerpt:\n{transcript[:4000]}"
    )
    try:
        quiz_raw = lyzr_agent_execute(
            "QUIZ",
            "Quiz Agent",
            "You generate multiple-choice quiz questions as JSON arrays.",
            quiz_prompt,
        )
        quiz_data = _parse_json_response(quiz_raw, [])
        if not isinstance(quiz_data, list):
            quiz_data = []
    except Exception:
        quiz_data = []
    if not quiz_data:
        quiz_data = generate_quiz_heuristic(concepts)

    return summary_data, flashcards_data, quiz_data, raw_notes
