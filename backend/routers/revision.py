import time
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from backend.database import get_db, DBFlashcard, DBUserProfile
from backend.services import lyzr_service

router = APIRouter(prefix="/api/revision", tags=["revision"])

class ReviewRequest(BaseModel):
    rating: str  # "hard", "ok", "easy"

class GoalCreateRequest(BaseModel):
    title: str
    topics: str
    timeline: int
    targetDate: str

@router.get("/flashcards")
async def get_due_flashcards(db: Session = Depends(get_db)):
    """Fetches all flashcards from SQLite."""
    try:
        flashcards = db.query(DBFlashcard).all()
        return [
            {
                "id": fc.id,
                "front": fc.front,
                "back": fc.back,
                "topic": fc.topic,
                "subject": fc.subject,
                "dueDate": fc.due_date,
                "ease": fc.ease,
                "interval": fc.interval
            }
            for fc in flashcards
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/flashcards/{card_id}/review")
async def review_flashcard(card_id: str, req: ReviewRequest, db: Session = Depends(get_db)):
    """Implements the SM-2 Spaced Repetition algorithm to schedule the next review."""
    try:
        card = db.query(DBFlashcard).filter(DBFlashcard.id == card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail="Flashcard not found")
            
        # Map quality rating to SM-2 grade (0-5 scale)
        if req.rating == "easy":
            grade = 5
        elif req.rating == "ok":
            grade = 4
        else: # "hard"
            grade = 2
            
        # SM-2 Spaced Repetition Formula
        if grade >= 3:
            if card.review_count == 0:
                card.interval = 1
            elif card.review_count == 1:
                card.interval = 6
            else:
                card.interval = int(round(card.interval * card.ease))
            card.review_count += 1
            card.success_rate = (card.success_rate * (card.review_count - 1) + 1.0) / card.review_count
        else:
            card.interval = 1
            card.review_count = 0
            card.success_rate = (card.success_rate * max(card.review_count - 1, 0)) / max(card.review_count, 1)

        # Update Ease Factor
        card.ease = card.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
        card.ease = max(card.ease, 1.3) # SM-2 lower bound
        
        # Calculate new due date
        new_due = (datetime.utcnow() + timedelta(days=card.interval)).strftime("%Y-%m-%d")
        card.due_date = new_due
        
        db.commit()
        return {
            "success": True,
            "id": card.id,
            "nextReviewDate": new_due,
            "interval": card.interval,
            "ease": card.ease
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/goals")
async def get_learning_goals():
    """Mock-returns available learning goals (normally loaded from SQLite)."""
    return [
        { "id": 1, "title": "Master DBMS in 30 days", "subjects": ["Normalization", "Transactions", "Indexing"], "progress": 62, "deadline": "2026-06-23" },
        { "id": 2, "title": "OS Kernel Deep Dive", "subjects": ["Memory Management", "Scheduling"], "progress": 45, "deadline": "2026-07-15" }
    ]

@router.post("/goals")
async def create_learning_goal(req: GoalCreateRequest, db: Session = Depends(get_db)):
    """Sets a study goal, calling Lyzr Planning Agent to draft milestones."""
    try:
        prompt = (
            f"Goal: '{req.title}' covering topics: '{req.topics}' "
            f"to complete in {req.timeline} days by date {req.targetDate}."
        )
        
        # Call Lyzr planner agent to create educational roadmap
        roadmap_json = lyzr_service.learning_analytics_agent.execute(prompt)
        
        # Update user weekly goal progress as visual feedback
        profile = db.query(DBUserProfile).filter(DBUserProfile.id == "demo-user").first()
        if profile:
            profile.weekly_goal_progress = min(profile.weekly_goal_progress + 5, 100)
            db.commit()
            
        return {
            "success": True,
            "goal": {
                "id": int(time.time()),
                "title": req.title,
                "subjects": [t.strip() for t in req.topics.split(",")],
                "progress": 0,
                "deadline": req.targetDate,
                "roadmapReport": roadmap_json
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
