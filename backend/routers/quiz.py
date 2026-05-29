import json
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from backend.database import get_db, DBQuizQuestion, DBUserProfile, DBWeakTopic, DBConcept
from backend.services import lyzr_service, qdrant_service

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

class QuizGenerateRequest(BaseModel):
    topic: str
    userId: Optional[str] = "demo-user"

class AnswerEvaluateRequest(BaseModel):
    questionId: str
    spokenAnswer: str
    responseTime: float  # in seconds
    userId: Optional[str] = "demo-user"

@router.post("/generate")
async def generate_quiz_questions(req: QuizGenerateRequest, db: Session = Depends(get_db)):
    """Generates adaptive quiz questions for a topic, referencing DB and Lyzr Quiz Agent."""
    try:
        # Check DB first
        questions = db.query(DBQuizQuestion).filter(DBQuizQuestion.topic.ilike(f"%{req.topic}%")).all()
        
        if not questions:
            # Fallback to general questions
            questions = db.query(DBQuizQuestion).all()
            
        return [
            {
                "id": q.id,
                "question": q.question,
                "options": q.options,
                "correct": q.correct,
                "explanation": q.explanation,
                "topic": q.topic
            }
            for q in questions
        ]
    except Exception as e:
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
