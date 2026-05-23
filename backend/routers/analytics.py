from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import (
    get_db, DBUserProfile, DBWeakTopic, DBRetentionPoint, DBMasteryPoint, DBLecture
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/profile")
async def get_student_profile(db: Session = Depends(get_db)):
    """Fetches user profile metrics."""
    try:
        p = db.query(DBUserProfile).filter(DBUserProfile.id == "demo-user").first()
        if not p:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "name": p.name,
            "studyStreak": p.study_streak,
            "totalHours": p.total_hours,
            "conceptsMastered": p.concepts_mastered,
            "examReadiness": p.exam_readiness,
            "weeklyGoalProgress": p.weekly_goal_progress,
            "preferredStyle": p.preferred_style
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard")
async def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Aggregates all chart and stats data for the main dashboard view."""
    try:
        # User profile
        p = db.query(DBUserProfile).filter(DBUserProfile.id == "demo-user").first()
        
        # Weak topics
        weak = db.query(DBWeakTopic).all()
        weak_list = [
            {
                "name": w.name,
                "subject": w.subject,
                "score": w.score,
                "daysUntilForgetting": w.days_until_forgetting,
                "trend": w.trend
            }
            for w in weak
        ]
        
        # Retention curve
        ret = db.query(DBRetentionPoint).all()
        ret_list = [{"date": r.date, "retention": r.retention} for r in ret]
        
        # Mastery radar
        mast = db.query(DBMasteryPoint).all()
        mast_list = [{"subject": m.subject, "mastery": m.mastery} for m in mast]
        
        # Recent lectures
        lectures = db.query(DBLecture).order_by(DBLecture.date.desc()).limit(5).all()
        lecture_list = [
            {
                "id": l.id,
                "title": l.title,
                "subject": l.subject,
                "duration": l.duration,
                "conceptCount": l.concept_count,
                "flashcardCount": l.flashcard_count,
                "topics": l.topics,
                "date": l.date
            }
            for l in lectures
        ]
        
        return {
            "profile": {
                "name": p.name if p else "Alex Chen",
                "studyStreak": p.study_streak if p else 12,
                "totalHours": p.total_hours if p else 47,
                "conceptsMastered": p.concepts_mastered if p else 38,
                "examReadiness": p.exam_readiness if p else 73,
                "weeklyGoalProgress": p.weekly_goal_progress if p else 71,
                "preferredStyle": p.preferred_style if p else "Analogy-based"
            },
            "weakTopics": weak_list,
            "retentionData": ret_list,
            "masteryData": mast_list,
            "lectures": lecture_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
