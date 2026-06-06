import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
import re
import uuid
from datetime import datetime, timedelta
from backend.services.agent_env import get_groq_credentials_for_backend
from backend.database import (
    get_db, DBUserProfile, DBWeakTopic, DBRetentionPoint, DBMasteryPoint, DBLecture,
    DBConcept, DBFlashcard, DBQuizQuestion, DBTranscriptChunk, DBQuizAttempt
)
from backend.services.content_extractor import process_transcript_with_llm_or_heuristic
from backend.services.transcript_processor import TranscriptProcessor
from backend.services.graph_service import build_graph_from_transcript
from backend.services.language_utils import resolve_language
from backend.services import qdrant_service
from backend.services.speech_service import transcribe_media_file, ALLOWED_UPLOAD_EXTENSIONS

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500MB practical server limit

class LectureUploadRequest(BaseModel):
    title: str
    subject: str
    duration: int
    transcript: str
    lecture_id: str | None = None
    language: str | None = "auto"

class LectureRenameRequest(BaseModel):
    title: str

class LectureSaveRequest(BaseModel):
    title: str
    subject: str
    duration: int
    transcript: str
    lecture_id: str
    language: str | None = "auto"
    category: str = "General"
    concepts: list = []
    concepts_details: list = []
    relationships: list = []
    topics_breakdown: list = []
    summary: str = ""
    notes: str = ""
    flashcards: list = []
    quizzes: list = []


def _lecture_to_dict(lecture: DBLecture) -> dict:
    return {
        "id": lecture.id,
        "title": lecture.title,
        "subject": lecture.subject,
        "duration": lecture.duration,
        "conceptCount": lecture.concept_count,
        "flashcardCount": lecture.flashcard_count,
        "topics": lecture.topics,
        "summary": lecture.summary,
        "notes": lecture.notes,
        "transcript": lecture.transcript,
        "topicsBreakdown": lecture.topics_breakdown,
        "conceptsDetails": lecture.concepts_details,
        "category": lecture.category,
        "date": lecture.date,
    }


def _processed_content_incomplete(result) -> bool:
    """True only when the client sent almost no processed content (avoid re-running on save)."""
    has_summary = bool((result.summary or "").strip())
    has_notes = bool((result.notes or "").strip())
    has_concepts = bool(result.concepts)
    if has_summary and has_notes and has_concepts:
        return False
    return not has_summary and not has_notes and not has_concepts


def _merge_processed_result(existing, fresh):
    """Prefer existing client-processed fields; fill gaps from a fresh server run."""
    if not (existing.summary or "").strip():
        existing.summary = fresh.summary
    if not (existing.notes or "").strip():
        existing.notes = fresh.notes
    if not existing.concepts:
        existing.concepts = fresh.concepts
    if not existing.concepts_details:
        existing.concepts_details = fresh.concepts_details
    if not existing.relationships:
        existing.relationships = fresh.relationships
    if not getattr(existing, "topics_breakdown", None):
        existing.topics_breakdown = fresh.topics_breakdown
    if not (existing.category or "").strip() or existing.category == "General":
        existing.category = fresh.category or existing.category
    if not existing.flashcards:
        existing.flashcards = fresh.flashcards
    if not existing.quizzes:
        existing.quizzes = fresh.quizzes
    if not (existing.language or "").strip():
        existing.language = fresh.language
    return existing

class TranscriptChunkRequest(BaseModel):
    lecture_id: str
    text: str
    chunk_type: str = "speech"
    timestamp: int | None = None

@router.post("/transcript-chunk")
async def persist_transcript_chunk(request: TranscriptChunkRequest, db: Session = Depends(get_db)):
    """Persist a live transcript chunk continuously during lecture recording."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Empty transcript chunk")
    chunk_id = f"chunk_{uuid.uuid4().hex[:10]}"
    db_chunk = DBTranscriptChunk(
        id=chunk_id,
        lecture_id=request.lecture_id,
        text=request.text.strip(),
        chunk_type=request.chunk_type,
        timestamp=str(request.timestamp or int(datetime.utcnow().timestamp() * 1000)),
    )
    db.add(db_chunk)
    db.commit()
    return {"status": "ok", "chunk_id": chunk_id}


@router.get("/transcript/{lecture_id}")
async def get_transcript_chunks(lecture_id: str, db: Session = Depends(get_db)):
    """Retrieve all persisted chunks for a lecture."""
    chunks = db.query(DBTranscriptChunk).filter(
        DBTranscriptChunk.lecture_id == lecture_id
    ).order_by(DBTranscriptChunk.created_at).all()
    return [
        {"id": c.id, "text": c.text, "type": c.chunk_type, "timestamp": c.timestamp}
        for c in chunks
    ]


def _persist_lecture_result(
    db: Session,
    lecture_id: str,
    user_title: str,
    subject: str,
    duration: int,
    transcript: str,
    result,
) -> dict:
    """Persist a processed lecture using the user-provided title."""
    existing_lecture = db.query(DBLecture).filter(DBLecture.id == lecture_id).first()
    if existing_lecture:
        db_lecture = existing_lecture
        db_lecture.title = user_title.strip()
        db_lecture.subject = subject
        db_lecture.duration = duration
        db_lecture.concept_count = len(result.concepts)
        db_lecture.flashcard_count = len(result.flashcards)
        db_lecture.topics = result.concepts
        db_lecture.summary = result.summary
        db_lecture.notes = result.notes
        db_lecture.transcript = transcript
        db_lecture.topics_breakdown = getattr(result, "topics_breakdown", []) or []
        db_lecture.concepts_details = result.concepts_details or []
        db_lecture.language = result.language
        db_lecture.category = result.category
        db_lecture.keywords_json = json.dumps(result.concepts)
    else:
        db_lecture = DBLecture(
            id=lecture_id,
            title=user_title.strip(),
            subject=subject,
            duration=duration,
            concept_count=len(result.concepts),
            flashcard_count=len(result.flashcards),
            topics=result.concepts,
            summary=result.summary,
            notes=result.notes,
            transcript=transcript,
            topics_breakdown=getattr(result, "topics_breakdown", []) or [],
            concepts_details=result.concepts_details or [],
            language=result.language,
            category=result.category,
            keywords_json=json.dumps(result.concepts),
        )
        db.add(db_lecture)

    # Ensure transcript chunks exist for this lecture
    existing_chunks = db.query(DBTranscriptChunk).filter(
        DBTranscriptChunk.lecture_id == lecture_id
    ).count()
    if existing_chunks == 0 and transcript.strip():
        for i, sentence in enumerate(
            [s.strip() for s in re.split(r'(?<=[.!?])\s+', transcript.strip()) if s.strip()]
            or [transcript.strip()]
        ):
            db.add(DBTranscriptChunk(
                id=f"chunk_{uuid.uuid4().hex[:10]}",
                lecture_id=lecture_id,
                text=sentence,
                chunk_type="speech",
                timestamp=str(int(datetime.utcnow().timestamp() * 1000) + i),
            ))

    # Concepts — dynamic graph from transcript
    existing_map = {c.id: {"mastery": c.mastery, "retention": c.retention} for c in db.query(DBConcept).all()}
    graph_nodes = build_graph_from_transcript(transcript, subject, existing_map, result.relationships)

    # Create lookup map of detailed concepts from LLM extraction stage
    details_map = {}
    for item in result.concepts_details:
        if isinstance(item, dict) and "concept" in item:
            details_map[item["concept"].lower()] = item

    for node in graph_nodes:
        detail = details_map.get(node["name"].lower())
        definition = detail.get("definition") if detail else node.get("definition")
        importance = detail.get("importance") if detail else node.get("importance", "Medium")
        related = detail.get("related_concepts") if detail else node.get("related_concepts", [])

        db_concept = db.query(DBConcept).filter(DBConcept.id == node["id"]).first()
        if not db_concept:
            db_concept = DBConcept(
                id=node["id"],
                name=node["name"],
                subject=node["subject"],
                mastery=node["mastery"],
                retention=node["retention"],
                connections=node["connections"],
                definition=definition,
                importance=importance,
                related_concepts_json=json.dumps(related)
            )
            db.add(db_concept)
        else:
            existing_connections = set(db_concept.connections)
            for conn in node["connections"]:
                existing_connections.add(conn)
            db_concept.connections = list(existing_connections)
            db_concept.mastery = node["mastery"]
            db_concept.retention = node["retention"]
            if definition:
                db_concept.definition = definition
            if importance:
                db_concept.importance = importance
            if related:
                db_concept.related_concepts_json = json.dumps(related)
            db.add(db_concept)

    # Fallback/merge: use result concepts to enrich DB concepts
    for name in result.concepts:
        concept_id = f"con_{name.lower().replace(' ', '_').replace('+', 'plus')}"
        db_concept = db.query(DBConcept).filter(DBConcept.id == concept_id).first()
        connections = [
            f"con_{c.lower().replace(' ', '_').replace('+', 'plus')}"
            for c in result.concepts if c != name
        ]
        detail = details_map.get(name.lower())
        definition = detail.get("definition") if detail else f"Core concept representing {name} within {subject}."
        importance = detail.get("importance") if detail else "Medium"
        related = detail.get("related_concepts") if detail else []

        if not db_concept:
            db_concept = DBConcept(
                id=concept_id, name=name, subject=subject,
                mastery=50.0, retention=60.0, connections=connections,
                definition=definition, importance=importance,
                related_concepts_json=json.dumps(related)
            )
            db.add(db_concept)
        else:
            existing_connections = set(db_concept.connections)
            for conn in connections:
                existing_connections.add(conn)
            db_concept.connections = list(existing_connections)
            if definition:
                db_concept.definition = definition
            if importance:
                db_concept.importance = importance
            if related:
                db_concept.related_concepts_json = json.dumps(related)
            db.add(db_concept)

    # Flashcards — skip duplicates so re-saving a lecture does not roll back the transaction
    for fc in result.flashcards:
        fc_id = fc.get("id") or f"fc_{uuid.uuid4().hex[:8]}"
        if db.query(DBFlashcard).filter(DBFlashcard.id == fc_id).first():
            continue
        db_fc = DBFlashcard(
            id=fc_id,
            front=fc.get("front", ""),
            back=fc.get("back", ""),
            topic=fc.get("topic", result.concepts[0] if result.concepts else "General"),
            subject=subject
        )
        db.add(db_fc)

    # Quizzes — skip duplicates for the same reason
    for q in result.quizzes:
        q_id = q.get("id") or f"q_{uuid.uuid4().hex[:8]}"
        if db.query(DBQuizQuestion).filter(DBQuizQuestion.id == q_id).first():
            continue
        db_q = DBQuizQuestion(
            id=q_id,
            question=q.get("question", ""),
            options=q.get("options", []),
            correct=q.get("correct", 0),
            explanation=q.get("explanation", ""),
            topic=q.get("topic", result.concepts[0] if result.concepts else "General"),
            difficulty=q.get("difficulty", "Medium"),
            question_type=q.get("question_type", "MCQ")
        )
        db.add(db_q)

    # Profile Update
    profile = db.query(DBUserProfile).filter(DBUserProfile.id == "demo-user").first()
    if profile:
        profile.total_hours += max(1, int(duration))
        all_concepts_count = db.query(DBConcept).count()
        profile.concepts_mastered = all_concepts_count
        profile.concepts_detected = all_concepts_count

        try:
            lprof = json.loads(profile.learning_profile_json or "{}")
        except Exception:
            lprof = {}

        if "weak_topics" not in lprof: lprof["weak_topics"] = []
        if "strong_topics" not in lprof: lprof["strong_topics"] = []
        if "quiz_scores" not in lprof: lprof["quiz_scores"] = []
        if "lecture_history" not in lprof: lprof["lecture_history"] = []
        if "study_time" not in lprof: lprof["study_time"] = 0

        lprof["study_time"] += max(1, int(duration))
        lprof["lecture_history"].append({
            "lecture_id": lecture_id,
            "title": user_title.strip(),
            "subject": subject,
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        })

        concepts_in_db = db.query(DBConcept).all()
        lprof["weak_topics"] = [c.name for c in concepts_in_db if c.mastery < 65.0]
        lprof["strong_topics"] = [c.name for c in concepts_in_db if c.mastery >= 75.0]

        profile.learning_profile_json = json.dumps(lprof)
        db.add(profile)

    db.commit()

    try:
        qdrant_service.store_memory(
            collection_name="lecture_memory_collection",
            payload={
                "lectureId": lecture_id,
                "title": db_lecture.title,
                "subject": subject,
                "concepts": result.concepts,
                "summary": result.summary[:1000],
                "timestamp": datetime.utcnow().isoformat(),
            },
            text_to_embed=f"{db_lecture.title}. {result.summary} {' '.join(result.concepts)}",
        )
    except Exception as qe:
        print(f"[Analytics] Qdrant lecture memory store failed: {qe}")

    return {
        "status": "success",
        "lectureId": lecture_id,
        "title": db_lecture.title,
        "concepts": result.concepts,
        "concepts_details": result.concepts_details,
        "topics_breakdown": getattr(result, "topics_breakdown", []) or [],
        "summary": result.summary,
        "notes": result.notes,
        "transcript": transcript,
        "flashcardCount": len(result.flashcards),
        "quizCount": len(result.quizzes),
        "lecture": _lecture_to_dict(db_lecture),
    }


@router.post("/lectures/transcribe-upload")
async def transcribe_lecture_upload(file: UploadFile = File(...)):
    """Transcribe an uploaded audio/video lecture file (MP3, MP4, WAV, M4A)."""
    import os

    filename = file.filename or "upload.mp3"
    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )

    try:
        transcript, duration_seconds = await transcribe_media_file(content, filename)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {ex}")

    if not transcript or len(transcript.strip()) < 10:
        raise HTTPException(
            status_code=422,
            detail="No speech detected in the uploaded file. Try a clearer recording.",
        )

    lecture_id = f"lec_{uuid.uuid4().hex[:8]}"
    duration_minutes = max(1, int((duration_seconds or max(60, len(transcript.split()) * 0.4)) / 60))

    return {
        "status": "transcribed",
        "lectureId": lecture_id,
        "transcript": transcript.strip(),
        "durationSeconds": duration_seconds,
        "durationMinutes": duration_minutes,
        "filename": filename,
        "wordCount": len(transcript.split()),
    }


@router.post("/lectures/process")
async def process_lecture_only(request: LectureUploadRequest):
    """Process transcript into notes/flashcards/quiz — does NOT save to library."""
    try:
        if not request.transcript or len(request.transcript.strip()) < 10:
            raise HTTPException(status_code=400, detail="Transcript too short to process")

        lecture_id = request.lecture_id or f"lec_{uuid.uuid4().hex[:8]}"
        processor = TranscriptProcessor()
        result = await asyncio.to_thread(
            processor.process,
            request.transcript,
            "Pending",
            request.subject,
            request.language,
            user_id="demo-user",
            lecture_id=lecture_id,
        )
        return {
            "status": "processed",
            "lectureId": lecture_id,
            "title": result.title,
            "category": result.category,
            "concepts": result.concepts,
            "concepts_details": result.concepts_details,
            "relationships": result.relationships,
            "topics_breakdown": result.topics_breakdown,
            "summary": result.summary,
            "notes": result.notes,
            "flashcards": result.flashcards,
            "quizzes": result.quizzes,
            "flashcardCount": len(result.flashcards),
            "quizCount": len(result.quizzes),
            "language": result.language,
        }
    except HTTPException:
        raise
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))


@router.post("/lectures/save")
async def save_processed_lecture(request: LectureSaveRequest, db: Session = Depends(get_db)):
    """Save a processed lecture to the library with a user-defined name."""
    try:
        if not request.title or not request.title.strip():
            raise HTTPException(status_code=400, detail="Lecture name is required")
        if not request.transcript or len(request.transcript.strip()) < 10:
            raise HTTPException(status_code=400, detail="Transcript too short to save")

        from backend.services.transcript_processor import TranscriptProcessingResult
        result = TranscriptProcessingResult(
            title=request.title.strip(),
            category=request.category,
            concepts=request.concepts,
            concepts_details=request.concepts_details,
            relationships=request.relationships,
            summary=request.summary,
            notes=request.notes,
            flashcards=request.flashcards,
            quizzes=request.quizzes,
            language=request.language or "en",
            topics_breakdown=request.topics_breakdown,
        )

        # Re-run processing on the server when the client payload is missing rich content
        if _processed_content_incomplete(result):
            processor = TranscriptProcessor()
            fresh = await asyncio.to_thread(
                processor.process,
                request.transcript,
                request.title.strip(),
                request.subject,
                request.language,
                user_id="demo-user",
                lecture_id=request.lecture_id,
            )
            result = _merge_processed_result(result, fresh)

        return _persist_lecture_result(
            db, request.lecture_id, request.title.strip(),
            request.subject, request.duration, request.transcript, result,
        )
    except HTTPException:
        raise
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(ex))


@router.get("/lectures/{lecture_id}")
async def get_lecture_detail(lecture_id: str, db: Session = Depends(get_db)):
    """Fetch a single saved lecture with full notes, summary, and topic breakdown."""
    lecture = db.query(DBLecture).filter(DBLecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return _lecture_to_dict(lecture)


@router.patch("/lectures/{lecture_id}")
async def rename_lecture(lecture_id: str, request: LectureRenameRequest, db: Session = Depends(get_db)):
    """Rename a saved lecture in the library."""
    try:
        title = (request.title or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="Lecture name is required")

        lecture = db.query(DBLecture).filter(DBLecture.id == lecture_id).first()
        if not lecture:
            raise HTTPException(status_code=404, detail="Lecture not found")

        lecture.title = title
        db.add(lecture)

        profile = db.query(DBUserProfile).filter(DBUserProfile.id == "demo-user").first()
        if profile and profile.learning_profile_json:
            try:
                lprof = json.loads(profile.learning_profile_json)
                for entry in lprof.get("lecture_history", []):
                    if entry.get("lecture_id") == lecture_id:
                        entry["title"] = title
                profile.learning_profile_json = json.dumps(lprof)
                db.add(profile)
            except Exception:
                pass

        db.commit()
        return {"status": "ok", "lectureId": lecture_id, "title": title}
    except HTTPException:
        raise
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(ex))


@router.delete("/lectures/{lecture_id}")
async def delete_lecture(lecture_id: str, db: Session = Depends(get_db)):
    """Delete a lecture and its transcript chunks from the library."""
    try:
        lecture = db.query(DBLecture).filter(DBLecture.id == lecture_id).first()
        if not lecture:
            raise HTTPException(status_code=404, detail="Lecture not found")

        db.query(DBTranscriptChunk).filter(DBTranscriptChunk.lecture_id == lecture_id).delete()
        db.delete(lecture)

        profile = db.query(DBUserProfile).filter(DBUserProfile.id == "demo-user").first()
        if profile:
            if profile.learning_profile_json:
                try:
                    lprof = json.loads(profile.learning_profile_json)
                    lprof["lecture_history"] = [
                        e for e in lprof.get("lecture_history", [])
                        if e.get("lecture_id") != lecture_id
                    ]
                    profile.learning_profile_json = json.dumps(lprof)
                except Exception:
                    pass
            profile.total_hours = max(0, profile.total_hours - max(1, int(lecture.duration or 0)))
            db.add(profile)

        db.commit()
        return {"status": "deleted", "lectureId": lecture_id}
    except HTTPException:
        raise
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(ex))


@router.post("/lectures")
async def save_and_process_lecture(request: LectureUploadRequest, db: Session = Depends(get_db)):
    """Legacy: process and save in one step (used when title already provided)."""
    try:
        if not request.transcript or len(request.transcript.strip()) < 10:
            raise HTTPException(status_code=400, detail="Transcript too short to process")

        lecture_id = request.lecture_id or f"lec_{uuid.uuid4().hex[:8]}"

        processor = TranscriptProcessor()
        result = await asyncio.to_thread(
            processor.process,
            request.transcript,
            request.title,
            request.subject,
            request.language,
            user_id="demo-user",
            lecture_id=lecture_id,
        )

        save_title = request.title.strip() if request.title and request.title != "Auto-detect" else result.title
        return _persist_lecture_result(
            db, lecture_id, save_title, request.subject, request.duration, request.transcript, result,
        )
    except HTTPException:
        raise
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(ex))

@router.get("/profile")
async def get_student_profile(db: Session = Depends(get_db)):
    """Fetches user profile metrics."""
    try:
        p = db.query(DBUserProfile).filter(DBUserProfile.id == "demo-user").first()
        if not p:
            raise HTTPException(status_code=404, detail="User not found")
        recommendations = []
        insights = []
        try:
            recommendations = json.loads(p.recommendations_json or "[]")
        except Exception:
            pass
        try:
            insights = json.loads(p.insights_json or "[]")
        except Exception:
            pass
        return {
            "name": p.name,
            "studyStreak": p.study_streak,
            "totalHours": p.total_hours,
            "conceptsMastered": p.concepts_mastered,
            "examReadiness": p.exam_readiness,
            "weeklyGoalProgress": p.weekly_goal_progress,
            "preferredStyle": p.preferred_style,
            "recommendations": recommendations,
            "insights": insights
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard")
async def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Aggregates all chart and stats data for the main dashboard view dynamically."""
    try:
        # 1. Fetch main models
        p = db.query(DBUserProfile).filter(DBUserProfile.id == "demo-user").first()
        concepts_list = db.query(DBConcept).all()
        all_lectures = db.query(DBLecture).all()
        today = datetime.utcnow()

        # Compile weak topics dynamically based on quiz/flashcard performance
        quiz_topic_stats = {}
        try:
            attempts = db.query(DBQuizAttempt).all()
            for att in attempts:
                if att.topic not in quiz_topic_stats:
                    quiz_topic_stats[att.topic] = []
                quiz_topic_stats[att.topic].append(1.0 if att.correct else 0.0)
        except Exception:
            pass

        fc_topic_stats = {}
        try:
            fcs = db.query(DBFlashcard).all()
            for fc in fcs:
                if fc.topic not in fc_topic_stats:
                    fc_topic_stats[fc.topic] = []
                if fc.review_count > 0:
                    fc_topic_stats[fc.topic].append(fc.success_rate)
                elif fc.ease < 2.2:
                    fc_topic_stats[fc.topic].append(0.3)
        except Exception:
            pass

        weak_topics_enriched = []
        all_detected_topics = set(list(quiz_topic_stats.keys()) + list(fc_topic_stats.keys()))
        for t in all_detected_topics:
            scores = quiz_topic_stats.get(t, []) + fc_topic_stats.get(t, [])
            if scores:
                avg_score = sum(scores) / len(scores)
                if avg_score < 0.65:
                    confidence = min(0.95, 0.4 + len(scores) * 0.1)
                    suggested = f"Re-read study notes and start a personalized 15-question quiz on {t}."
                    if avg_score < 0.4:
                        suggested = f"Ask the AI Tutor to teach you {t} step-by-step from first principles, then do flashcard reviews."
                    weak_topics_enriched.append({
                        "topic": t,
                        "confidence": round(confidence, 2),
                        "suggested_revision": suggested
                    })

        # Persist enriched weak topics to learning profile JSON
        if p:
            try:
                lprof = json.loads(p.learning_profile_json or "{}")
            except Exception:
                lprof = {}
            lprof["weak_topics_details"] = weak_topics_enriched
            p.learning_profile_json = json.dumps(lprof)
            db.add(p)
            db.commit()

        # 2. Dynamic Weak Topics (Bottom 5 concepts by mastery)
        weak_list = []
        sorted_concepts = sorted(concepts_list, key=lambda c: c.mastery)
        for c in sorted_concepts[:5]:
            try:
                last_rev_dt = datetime.strptime(c.last_reviewed, "%Y-%m-%d")
                days_diff = (today.date() - last_rev_dt.date()).days
                days_left = max(1, 7 - days_diff)
            except Exception:
                days_left = 3
                
            trend = "stable"
            if c.retention < c.mastery:
                trend = "declining"
            elif c.retention > c.mastery:
                trend = "improving"
                
            weak_list.append({
                "name": c.name,
                "subject": c.subject,
                "score": c.mastery,
                "daysUntilForgetting": days_left,
                "trend": trend
            })

        # 3. Dynamic 7-day Retention Curve
        ret_list = []
        for i in range(6, -1, -1):
            day_dt = today - timedelta(days=i)
            day_str = day_dt.strftime("%b %d")
            
            if not concepts_list:
                ret_list.append({"date": day_str, "retention": 0.0})
            else:
                day_retentions = []
                for c in concepts_list:
                    try:
                        last_rev_dt = datetime.strptime(c.last_reviewed, "%Y-%m-%d")
                        days_diff = (day_dt.date() - last_rev_dt.date()).days
                        ret = c.retention * (0.95 ** max(0, days_diff))
                        day_retentions.append(max(10.0, min(100.0, ret)))
                    except Exception:
                        day_retentions.append(c.retention)
                avg_ret = sum(day_retentions) / len(day_retentions)
                ret_list.append({"date": day_str, "retention": round(avg_ret, 1)})

        # 4. Dynamic Mastery Radar Chart — subjects from actual concept data
        subject_masteries: dict = {}
        for c in concepts_list:
            if c.subject not in subject_masteries:
                subject_masteries[c.subject] = []
            subject_masteries[c.subject].append(c.mastery)

        mast_list = []
        for subj, scores in subject_masteries.items():
            mast_list.append({"subject": subj, "mastery": round(sum(scores) / len(scores), 1)})
        if not mast_list:
            mast_list = [{"subject": "No data yet", "mastery": 0.0}]

        # 5. Recent Lectures
        recent_lectures = db.query(DBLecture).order_by(DBLecture.date.desc()).limit(5).all()
        lecture_list = [_lecture_to_dict(l) for l in recent_lectures]

        # 6. Update user profile statistics dynamically
        recommendations = []
        insights = []
        
        if p:
            total_duration_mins = sum(l.duration for l in all_lectures)
            p.total_hours = max(0, int(total_duration_mins / 60))
            p.concepts_mastered = len(concepts_list)  # Total concepts in knowledge graph
            try:
                p.concepts_detected = len(concepts_list)  # Track all detected concepts
            except Exception:
                pass  # column may not exist in older DBs
            
            if concepts_list:
                p.exam_readiness = int(sum(c.mastery for c in concepts_list) / len(concepts_list))
            else:
                p.exam_readiness = 0
            
            # Study streak from consecutive lecture days
            lecture_dates = sorted(list(set(l.date for l in all_lectures)), reverse=True)
            streak = 0
            check_date = today.date()
            while True:
                check_date_str = check_date.strftime("%Y-%m-%d")
                if check_date_str in lecture_dates:
                    streak += 1
                    check_date -= timedelta(days=1)
                else:
                    break
            p.study_streak = streak

            # Rules-based dynamic recommendations and insights
            if weak_list:
                recommendations.append(f"Review {weak_list[0]['name']} due to declining retention")
            if sorted_concepts and len(sorted_concepts) > 1:
                recommendations.append(f"Complete flashcards on {sorted_concepts[-1].name} to maintain mastery")
            if len(all_lectures) > 0:
                recommendations.append(f"Re-read study notes for {all_lectures[0].title}")
            else:
                recommendations.append("Record your first lecture to build your concept map")
                
            if concepts_list:
                low_ret = [c for c in concepts_list if c.retention < 60]
                if low_ret:
                    insights.append(f"Spaced repetition shows {low_ret[0].name} mastery is dropping.")
                insights.append(f"You have indexed {len(concepts_list)} concepts across {len(lecture_dates)} days.")
            else:
                insights.append("Your cognitive map is ready. Start learning to populate insights.")
                
            p.recommendations_json = json.dumps(recommendations)
            p.insights_json = json.dumps(insights)
            db.add(p)
            db.commit()
            
        return {
            "profile": {
                "name": p.name if p else "Learner",
                "studyStreak": p.study_streak if p else 0,
                "totalHours": p.total_hours if p else 0,
                "conceptsMastered": p.concepts_mastered if p else 0,
                "examReadiness": p.exam_readiness if p else 0,
                "weeklyGoalProgress": p.weekly_goal_progress if p else 0,
                "preferredStyle": p.preferred_style if p else "Analogy-based",
                "recommendations": recommendations,
                "insights": insights
            },
            "weakTopics": weak_list,
            "weakTopicsEnriched": weak_topics_enriched,
            "retentionData": ret_list,
            "masteryData": mast_list,
            "lectures": lecture_list
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
