"""
Revision content service — gathers optional lecture context from DB and generates
quizzes via LLM-first pipeline (works with or without local lecture data).
"""
import json
import uuid
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from backend.database import (
    DBLecture, DBConcept, DBFlashcard, DBQuizQuestion,
    DBTranscriptChunk, DBUserProfile,
)
from backend.services.llm_study_service import generate_quiz_open_world


def _topic_matches(text: str, topic: str) -> bool:
    if not text or not topic:
        return False
    t = topic.lower().strip()
    s = text.lower()
    if t in s:
        return True
    for word in t.split():
        if len(word) > 3 and word in s:
            return True
    return False


def gather_lecture_context_for_topic(topic: str, db: Session) -> Dict[str, Any]:
    """
    Collect optional local notes/summaries related to a topic.
    Returns has_local_context=False when nothing relevant exists — LLM still works.
    """
    topic_lower = (topic or "General").lower().strip()
    all_lectures = db.query(DBLecture).order_by(DBLecture.date.desc()).all()

    scored: List[tuple[int, DBLecture]] = []
    for lec in all_lectures:
        score = 0
        if _topic_matches(lec.title, topic_lower):
            score += 5
        if _topic_matches(lec.subject, topic_lower):
            score += 3
        if _topic_matches(lec.summary or "", topic_lower):
            score += 4
        if _topic_matches(lec.notes or "", topic_lower):
            score += 4
        if _topic_matches(lec.category or "", topic_lower):
            score += 2
        for t in lec.topics:
            if _topic_matches(t, topic_lower) or _topic_matches(topic_lower, t):
                score += 6
        if score > 0:
            scored.append((score, lec))

    scored.sort(key=lambda x: -x[0])
    matching_lectures = [lec for _, lec in scored[:5]]

    notes_parts: List[str] = []
    summary_parts: List[str] = []
    transcript_parts: List[str] = []
    concept_names: List[str] = []
    concepts_details: List[Dict[str, Any]] = []
    relationships: List[Dict[str, Any]] = []
    flashcards_ctx: List[Dict[str, Any]] = []

    for lec in matching_lectures:
        if lec.summary:
            summary_parts.append(f"[{lec.title}]\n{lec.summary}")
        if lec.notes:
            notes_parts.append(f"## {lec.title}\n{lec.notes}")
        for t in lec.topics:
            if t not in concept_names and t.lower() != "general study material":
                concept_names.append(t)

        chunks = db.query(DBTranscriptChunk).filter(
            DBTranscriptChunk.lecture_id == lec.id
        ).order_by(DBTranscriptChunk.created_at).all()
        if chunks:
            transcript_parts.append(" ".join(c.text for c in chunks))
        elif lec.notes:
            transcript_parts.append(lec.notes[:3000])

    # Only pull DB concepts that actually match the topic
    for c in db.query(DBConcept).all():
        if _topic_matches(c.name, topic_lower) or _topic_matches(c.subject, topic_lower):
            if c.name not in concept_names:
                concept_names.append(c.name)
            try:
                related = json.loads(c.related_concepts_json or "[]")
            except Exception:
                related = []
            if c.definition:
                concepts_details.append({
                    "concept": c.name,
                    "definition": c.definition,
                    "importance": c.importance or "Medium",
                    "related_concepts": related,
                })

    topic_flashcards = db.query(DBFlashcard).filter(
        DBFlashcard.topic.ilike(f"%{topic}%")
    ).limit(20).all()
    for fc in topic_flashcards:
        flashcards_ctx.append({"front": fc.front, "back": fc.back, "topic": fc.topic})

    if topic_clean := topic.strip():
        if topic_clean not in concept_names:
            concept_names.insert(0, topic_clean)

    if not concept_names:
        concept_names = [topic.strip() or "General"]

    learning_history: Dict[str, Any] = {}
    profile = db.query(DBUserProfile).filter(DBUserProfile.id == "demo-user").first()
    if profile and profile.learning_profile_json:
        try:
            learning_history = json.loads(profile.learning_profile_json)
        except Exception:
            pass

    combined_notes = "\n\n".join(notes_parts)
    combined_summary = "\n\n".join(summary_parts)
    combined_transcript = "\n\n".join(transcript_parts)
    if not combined_transcript and combined_notes:
        combined_transcript = combined_notes
    elif not combined_transcript and combined_summary:
        combined_transcript = combined_summary

    has_local = bool(
        matching_lectures
        and (combined_transcript.strip() or combined_notes.strip())
    )

    return {
        "topic": topic,
        "has_local_context": has_local,
        "lectures": matching_lectures,
        "notes": combined_notes,
        "summary": combined_summary,
        "transcript": combined_transcript,
        "concepts": concept_names,
        "concepts_details": concepts_details,
        "relationships": relationships,
        "flashcards": flashcards_ctx,
        "learning_history": learning_history,
        "subject": matching_lectures[0].subject if matching_lectures else "General",
    }


def _persist_quiz_questions(questions: List[Dict[str, Any]], topic: str, db: Session) -> List[Dict[str, Any]]:
    saved = []
    for q in questions:
        if not q.get("question"):
            continue
        options = q.get("options") or []
        if isinstance(options, str):
            try:
                options = json.loads(options)
            except Exception:
                options = []
        if len(options) < 2:
            continue
        while len(options) < 4:
            options.append("None of the above")
        qid = f"q_{uuid.uuid4().hex[:8]}"
        db_q = DBQuizQuestion(
            id=qid,
            question=q.get("question", ""),
            options=options[:4],
            correct=min(int(q.get("correct", 0)), 3),
            explanation=q.get("explanation", ""),
            topic=q.get("topic", topic),
            difficulty=q.get("difficulty", "Medium"),
            question_type=q.get("question_type", "MCQ"),
        )
        db.add(db_q)
        saved.append({
            "id": qid,
            "question": db_q.question,
            "options": db_q.options,
            "correct": db_q.correct,
            "explanation": db_q.explanation or "",
            "topic": db_q.topic,
        })
    if saved:
        db.commit()
    return saved


def _is_shallow_question(q: Dict[str, Any]) -> bool:
    """Detect generic placeholder questions that should not be returned from cache."""
    text = (q.get("question") or "").lower()
    shallow_phrases = [
        "general study material",
        "based on your lecture materials",
        "which statement best describes general",
        "is a core concept covered in this lecture",
        "is unrelated to this subject",
    ]
    return any(p in text for p in shallow_phrases)


def generate_quiz_for_topic(
    topic: str,
    db: Session,
    count: int = 10,
    force_regenerate: bool = False,
) -> List[Dict[str, Any]]:
    """
    Generate quiz questions for any topic.
    LLM is primary — local DB is optional enrichment only.
    """
    topic_clean = (topic or "General").strip()
    count = max(10, min(count, 25))

    if not force_regenerate:
        existing = db.query(DBQuizQuestion).filter(
            DBQuizQuestion.topic.ilike(f"%{topic_clean}%")
        ).all()
        good_existing = [
            q for q in existing
            if not _is_shallow_question({"question": q.question})
        ]
        if len(good_existing) >= count:
            return [
                {
                    "id": q.id,
                    "question": q.question,
                    "options": q.options,
                    "correct": q.correct,
                    "explanation": q.explanation or "",
                    "topic": q.topic,
                }
                for q in good_existing[:count]
            ]

    ctx = gather_lecture_context_for_topic(topic_clean, db)

    local_context = ""
    if ctx["has_local_context"]:
        parts = []
        if ctx["notes"]:
            parts.append(ctx["notes"])
        if ctx["summary"]:
            parts.append(ctx["summary"])
        if ctx["transcript"]:
            parts.append(ctx["transcript"])
        local_context = "\n\n".join(parts)

    # LLM-first: works even when has_local_context is False
    questions = generate_quiz_open_world(
        topic=topic_clean,
        count=count,
        local_context=local_context if ctx["has_local_context"] else None,
    )

    mcq_questions = [
        q for q in questions
        if q.get("options") and len(q.get("options", [])) >= 2
        and not _is_shallow_question(q)
    ]

    if len(mcq_questions) < count:
        mcq_questions = [q for q in questions if q.get("options")][:count]

    saved = _persist_quiz_questions(mcq_questions[:count], topic_clean, db)
    return saved if saved else mcq_questions[:count]
