from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
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

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

class LectureUploadRequest(BaseModel):
    title: str
    subject: str
    duration: int
    transcript: str
    lecture_id: str | None = None
    language: str | None = "auto"

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


@router.post("/lectures")
async def save_and_process_lecture(request: LectureUploadRequest, db: Session = Depends(get_db)):
    """Receives lecture transcripts, extracts real content, and persists to relational tables."""
    try:
        if not request.transcript or len(request.transcript.strip()) < 10:
            raise HTTPException(status_code=400, detail="Transcript too short to process")

        lecture_id = request.lecture_id or f"lec_{uuid.uuid4().hex[:8]}"

        # Process the transcript using the unified intelligence pipeline
        processor = TranscriptProcessor()
        result = processor.process(
            request.transcript, request.title, request.subject, request.language,
            user_id="demo-user", lecture_id=lecture_id
        )

        db_lecture = DBLecture(
            id=lecture_id,
            title=result.title,
            subject=request.subject,
            duration=request.duration,
            concept_count=len(result.concepts),
            flashcard_count=len(result.flashcards),
            topics=result.concepts,
            summary=result.summary,
            notes=result.notes,
            language=result.language,
            category=result.category,
            keywords_json=json.dumps(result.concepts),
        )
        db.add(db_lecture)

        # Concepts — dynamic graph from transcript
        existing_map = {c.id: {"mastery": c.mastery, "retention": c.retention} for c in db.query(DBConcept).all()}
        graph_nodes = build_graph_from_transcript(request.transcript, request.subject, existing_map, result.relationships)

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
            definition = detail.get("definition") if detail else f"Core concept representing {name} within {request.subject}."
            importance = detail.get("importance") if detail else "Medium"
            related = detail.get("related_concepts") if detail else []

            if not db_concept:
                db_concept = DBConcept(
                    id=concept_id, name=name, subject=request.subject,
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

        # Flashcards
        for fc in result.flashcards:
            fc_id = f"fc_{uuid.uuid4().hex[:8]}"
            db_fc = DBFlashcard(
                id=fc_id,
                front=fc.get("front", ""),
                back=fc.get("back", ""),
                topic=fc.get("topic", result.concepts[0] if result.concepts else "General"),
                subject=request.subject
            )
            db.add(db_fc)

        # Quizzes
        for q in result.quizzes:
            db_q = DBQuizQuestion(
                id=f"q_{uuid.uuid4().hex[:8]}",
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
            profile.total_hours += max(1, int(request.duration))
            # Track all detected concepts in knowledge graph dynamically
            all_concepts_count = db.query(DBConcept).count()
            profile.concepts_mastered = all_concepts_count
            profile.concepts_detected = all_concepts_count

            # Initialize / update learning profile JSON history
            try:
                lprof = json.loads(profile.learning_profile_json or "{}")
            except Exception:
                lprof = {}

            if "weak_topics" not in lprof: lprof["weak_topics"] = []
            if "strong_topics" not in lprof: lprof["strong_topics"] = []
            if "quiz_scores" not in lprof: lprof["quiz_scores"] = []
            if "lecture_history" not in lprof: lprof["lecture_history"] = []
            if "study_time" not in lprof: lprof["study_time"] = 0

            lprof["study_time"] += max(1, int(request.duration))
            lprof["lecture_history"].append({
                "lecture_id": lecture_id,
                "title": result.title,
                "subject": request.subject,
                "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            })

            # Update weak/strong topics dynamically
            concepts_in_db = db.query(DBConcept).all()
            lprof["weak_topics"] = [c.name for c in concepts_in_db if c.mastery < 65.0]
            lprof["strong_topics"] = [c.name for c in concepts_in_db if c.mastery >= 75.0]

            profile.learning_profile_json = json.dumps(lprof)
            db.add(profile)

        # Sync/Commit DB
        db.commit()

        # Store lecture memory in Qdrant for semantic retrieval
        try:
            qdrant_service.store_memory(
                collection_name="lecture_memory_collection",
                payload={
                    "lectureId": lecture_id,
                    "title": db_lecture.title,
                    "subject": request.subject,
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
            "summary": result.summary,
            "notes": result.notes,
            "flashcardCount": len(result.flashcards),
            "quizCount": len(result.quizzes)
        }
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
        lecture_list = [
            {
                "id": l.id,
                "title": l.title,
                "subject": l.subject,
                "duration": l.duration,
                "conceptCount": l.concept_count,
                "flashcardCount": l.flashcard_count,
                "topics": l.topics,
                "summary": l.summary,
                "notes": l.notes,
                "date": l.date
            }
            for l in recent_lectures
        ]

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
