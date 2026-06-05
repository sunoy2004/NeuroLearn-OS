import json
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from backend.database import get_db, DBQuizQuestion, DBUserProfile, DBWeakTopic, DBQuizAttempt, DBSavedQuiz
from backend.services import lyzr_service, qdrant_service
from backend.services.revision_content_service import generate_quiz_for_topic, analyze_quiz_session
import uuid

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

class QuizGenerateRequest(BaseModel):
    topic: str
    userId: Optional[str] = "demo-user"
    count: int = 10
    forceRegenerate: bool = False

class AnswerEvaluateRequest(BaseModel):
    questionId: str
    spokenAnswer: str
    responseTime: float  # in seconds
    userId: Optional[str] = "demo-user"

class QuizAnswerSubmission(BaseModel):
    questionId: str
    selectedAnswer: int
    correct: bool
    topic: str

class QuizSubmitRequest(BaseModel):
    topic: str
    answers: list[QuizAnswerSubmission]
    userId: Optional[str] = "demo-user"

class QuizSaveSessionRequest(BaseModel):
    topic: str
    questions: list[dict]
    correct: int
    total: int
    accuracy: float
    analysis: Optional[dict] = None
    sessionId: Optional[str] = None

@router.post("/generate")
async def generate_quiz_questions(req: QuizGenerateRequest):
    """Generate adaptive quiz questions for a topic using LLM (no long-lived DB session)."""
    try:
        topic = (req.topic or "General").strip()
        count = max(10, min(req.count, 30))

        questions = generate_quiz_for_topic(
            topic=topic,
            count=count,
            force_regenerate=req.forceRegenerate,
        )

        if not questions:
            raise HTTPException(
                status_code=404,
                detail=f"No quiz questions could be generated for '{topic}'. Record a lecture on this topic first.",
            )

        return questions
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit")
async def submit_quiz_session(req: QuizSubmitRequest, db: Session = Depends(get_db)):
    """Persist quiz session results and return score + performance analysis."""
    try:
        if not req.answers:
            raise HTTPException(status_code=400, detail="No answers submitted")

        total = len(req.answers)
        correct_count = sum(1 for a in req.answers if a.correct)
        wrong_count = total - correct_count
        accuracy = round((correct_count / total) * 100, 1) if total else 0.0

        answer_dicts = []
        for a in req.answers:
            attempt_id = f"qa_{uuid.uuid4().hex[:8]}"
            db_attempt = DBQuizAttempt(
                id=attempt_id,
                question_id=a.questionId,
                topic=a.topic or req.topic,
                selected_answer=a.selectedAnswer,
                correct=a.correct,
                score=1.0 if a.correct else 0.0,
            )
            db.add(db_attempt)
            answer_dicts.append({
                "questionId": a.questionId,
                "topic": a.topic,
                "correct": a.correct,
            })

        profile = db.query(DBUserProfile).filter(DBUserProfile.id == req.userId).first()
        if profile:
            try:
                lprof = json.loads(profile.learning_profile_json or "{}")
            except Exception:
                lprof = {}
            if "quiz_scores" not in lprof:
                lprof["quiz_scores"] = []
            lprof["quiz_scores"].append({
                "topic": req.topic,
                "total": total,
                "correct": correct_count,
                "accuracy": accuracy,
                "timestamp": time.time(),
            })
            analysis = analyze_quiz_session(answer_dicts)
            for area in analysis.get("weakAreas", []):
                if area not in lprof.get("weak_topics", []):
                    lprof.setdefault("weak_topics", []).append(area)
            for area in analysis.get("strongAreas", []):
                if area not in lprof.get("strong_topics", []):
                    lprof.setdefault("strong_topics", []).append(area)
            profile.learning_profile_json = json.dumps(lprof)
            if accuracy >= 70:
                profile.exam_readiness = min(profile.exam_readiness + 2, 99)
            else:
                profile.exam_readiness = max(profile.exam_readiness - 1, 20)
            db.add(profile)

        db.commit()

        analysis = analyze_quiz_session(answer_dicts)
        return {
            "topic": req.topic,
            "total": total,
            "correct": correct_count,
            "wrong": wrong_count,
            "accuracy": accuracy,
            "analysis": analysis,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions")
async def list_saved_quiz_sessions(db: Session = Depends(get_db)):
    """List quizzes saved after completion."""
    try:
        sessions = db.query(DBSavedQuiz).order_by(DBSavedQuiz.updated_at.desc()).all()
        return [
            {
                "id": s.id,
                "topic": s.topic,
                "title": s.title,
                "totalQuestions": s.total_questions,
                "lastScore": s.last_score,
                "bestScore": s.best_score,
                "lastAccuracy": s.last_accuracy,
                "attemptCount": s.attempt_count,
                "savedAt": s.saved_at,
                "updatedAt": s.updated_at,
                "needsReattempt": s.last_score < 8,
            }
            for s in sessions
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}")
async def get_saved_quiz_session(session_id: str, db: Session = Depends(get_db)):
    """Load a saved quiz's questions for reattempt."""
    try:
        session = db.query(DBSavedQuiz).filter(DBSavedQuiz.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Saved quiz not found")
        try:
            questions = json.loads(session.questions_json)
        except Exception:
            questions = []
        try:
            analysis = json.loads(session.analysis_json or "{}")
        except Exception:
            analysis = {}
        return {
            "id": session.id,
            "topic": session.topic,
            "title": session.title,
            "questions": questions,
            "totalQuestions": session.total_questions,
            "lastScore": session.last_score,
            "bestScore": session.best_score,
            "lastAccuracy": session.last_accuracy,
            "attemptCount": session.attempt_count,
            "analysis": analysis,
            "needsReattempt": session.last_score < 8,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/save")
async def save_quiz_session(req: QuizSaveSessionRequest, db: Session = Depends(get_db)):
    """Save a completed quiz to the quiz library for later reattempt."""
    try:
        if not req.questions:
            raise HTTPException(status_code=400, detail="No questions to save")

        topic = (req.topic or "General").strip()
        title = f"{topic} Quiz"
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        analysis_json = json.dumps(req.analysis or {})

        if req.sessionId:
            session = db.query(DBSavedQuiz).filter(DBSavedQuiz.id == req.sessionId).first()
            if session:
                session.last_score = req.correct
                session.best_score = max(session.best_score, req.correct)
                session.total_questions = req.total
                session.last_accuracy = req.accuracy
                session.attempt_count = (session.attempt_count or 0) + 1
                session.analysis_json = analysis_json
                session.updated_at = now
                db.add(session)
                db.commit()
                return {
                    "id": session.id,
                    "topic": session.topic,
                    "title": session.title,
                    "totalQuestions": session.total_questions,
                    "lastScore": session.last_score,
                    "bestScore": session.best_score,
                    "lastAccuracy": session.last_accuracy,
                    "attemptCount": session.attempt_count,
                    "needsReattempt": session.last_score < 8,
                }

        session_id = f"sq_{uuid.uuid4().hex[:10]}"
        session = DBSavedQuiz(
            id=session_id,
            topic=topic,
            title=title,
            questions_json=json.dumps(req.questions),
            last_score=req.correct,
            best_score=req.correct,
            total_questions=req.total,
            last_accuracy=req.accuracy,
            attempt_count=1,
            analysis_json=analysis_json,
            saved_at=now,
            updated_at=now,
        )
        db.add(session)
        db.commit()
        return {
            "id": session.id,
            "topic": session.topic,
            "title": session.title,
            "totalQuestions": session.total_questions,
            "lastScore": session.last_score,
            "bestScore": session.best_score,
            "lastAccuracy": session.last_accuracy,
            "attemptCount": session.attempt_count,
            "needsReattempt": session.last_score < 8,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate")
async def evaluate_quiz_answer(req: AnswerEvaluateRequest, db: Session = Depends(get_db)):
    """Evaluates verbal answers, analyzing hesitation filler words, speed, and accuracy."""
    try:
        # 1. Fetch question to verify correct answer
        question = db.query(DBQuizQuestion).filter(DBQuizQuestion.id == req.questionId).first()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
            
        correct_index = question.correct
        correct_option_text = question.options[correct_index]
        
        # 2. Heuristic filler word hesitation check
        filler_words = ["uh", "um", "uhm", "ah", "like", "well", "basically", "actually", "probably"]
        detected_fillers = [word for word in filler_words if f" {word} " in f" {req.spokenAnswer.lower()} "]
        
        # Calculate hesitation penalty
        hesitation_score = len(detected_fillers) * 1.5 + (max(req.responseTime - 5.0, 0.0) * 0.5) # normal response is 5s
        
        # Calculate confidence (out of 100)
        confidence_score = max(100.0 - (hesitation_score * 10), 20.0)
        
        # 3. Call Lyzr Quiz Agent to check answer semantic accuracy vs correct choice
        prompt = (
            f"Question: {question.question}\n"
            f"Expected answer option: '{correct_option_text}'\n"
            f"Student verbal answer: '{req.spokenAnswer}'\n"
            "Assess the correctness. Respond with a JSON object containing keys: "
            "'accuracy' (float 0.0 to 1.0), 'conceptualDepth' (float 0.0 to 1.0), "
            "'feedback' (text explaining correctness)."
        )
        
        lyzr_response = lyzr_service.quiz_intelligence_agent.execute(prompt)
        try:
            eval_data = json.loads(lyzr_response)
        except Exception:
            # Fallback parsing
            is_correct = any(word in req.spokenAnswer.lower() for word in correct_option_text.lower().split())
            eval_data = {
                "accuracy": 1.0 if is_correct else 0.0,
                "conceptualDepth": 0.8 if is_correct else 0.2,
                "feedback": "Semantically correct answer based on choice selection." if is_correct else "The answer did not match the correct option."
            }
            
        accuracy = eval_data.get("accuracy", 0.0)
        
        # 4. Save results to Qdrant quiz_performance_collection
        qdrant_service.store_memory(
            collection_name="quiz_performance_collection",
            payload={
                "userId": req.userId,
                "questionId": req.questionId,
                "spokenAnswer": req.spokenAnswer,
                "accuracy": accuracy,
                "confidenceScore": confidence_score,
                "responseTime": req.responseTime,
                "hesitationWords": detected_fillers,
                "timestamp": time.time()
            },
            text_to_embed=f"Answer: {req.spokenAnswer}. Feedback: {eval_data.get('feedback')}"
        )
        
        # 5. Adapt student profile database variables
        profile = db.query(DBUserProfile).filter(DBUserProfile.id == req.userId).first()
        if profile:
            if accuracy > 0.7:
                profile.study_streak = min(profile.study_streak + 1, 30)
                profile.exam_readiness = min(profile.exam_readiness + 1, 99)
            else:
                profile.exam_readiness = max(profile.exam_readiness - 1, 30)
                # flag weak topic in DB
                wt = db.query(DBWeakTopic).filter(DBWeakTopic.name == question.topic).first()
                if not wt:
                    new_wt = DBWeakTopic(name=question.topic, subject="DBMS", score=45.0, days_until_forgetting=2, trend="declining")
                    db.add(new_wt)
                else:
                    wt.score = max(wt.score - 5.0, 10.0)
                    wt.days_until_forgetting = 1

            # Update rich learning profile JSON
            try:
                lprof = json.loads(profile.learning_profile_json or "{}")
            except Exception:
                lprof = {}

            if "weak_topics" not in lprof: lprof["weak_topics"] = []
            if "strong_topics" not in lprof: lprof["strong_topics"] = []
            if "quiz_scores" not in lprof: lprof["quiz_scores"] = []
            if "revision_history" not in lprof: lprof["revision_history"] = []

            lprof["quiz_scores"].append({
                "question_id": req.questionId,
                "topic": question.topic,
                "accuracy": accuracy,
                "confidence": confidence_score,
                "timestamp": time.time()
            })

            # Update weak/strong lists based on quiz accuracy
            if accuracy < 0.6:
                if question.topic not in lprof["weak_topics"]:
                    lprof["weak_topics"].append(question.topic)
                if question.topic in lprof["strong_topics"]:
                    try:
                        lprof["strong_topics"].remove(question.topic)
                    except ValueError:
                        pass
            elif accuracy >= 0.8:
                if question.topic not in lprof["strong_topics"]:
                    lprof["strong_topics"].append(question.topic)
                if question.topic in lprof["weak_topics"]:
                    try:
                        lprof["weak_topics"].remove(question.topic)
                    except ValueError:
                        pass

            profile.learning_profile_json = json.dumps(lprof)
            db.add(profile)
            db.commit()
            
        return {
            "questionId": req.questionId,
            "spokenAnswer": req.spokenAnswer,
            "evaluation": {
                "accuracy": accuracy,
                "understanding": eval_data.get("conceptualDepth", 0.5),
                "hesitation": {
                    "pauseBeforeAnswer": req.responseTime,
                    "fillerWords": detected_fillers,
                    "repetitions": 0,
                    "confidenceScore": confidence_score
                },
                "feedback": eval_data.get("feedback", "")
            },
            "responseTime": req.responseTime
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
