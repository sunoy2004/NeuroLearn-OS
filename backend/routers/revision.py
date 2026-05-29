import os
import time
from backend.services.agent_env import get_groq_credentials_for_backend
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from openai import OpenAI
from backend.database import get_db, DBFlashcard, DBUserProfile, DBLearningGoal

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
async def get_learning_goals(db: Session = Depends(get_db)):
    """Returns available learning goals from SQLite."""
    try:
        goals = db.query(DBLearningGoal).all()
        return [
            {
                "id": g.id,
                "title": g.title,
                "subjects": g.topics,
                "progress": g.progress,
                "deadline": g.deadline,
                "roadmapReport": g.roadmap_report
            }
            for g in goals
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/goals")
async def create_learning_goal(req: GoalCreateRequest, db: Session = Depends(get_db)):
    """Sets a study goal, calling the LLM provider to draft milestones."""
    try:
        prompt = (
            f"Generate a bullet-pointed educational milestone roadmap for a goal: '{req.title}' "
            f"covering topics: '{req.topics}' to complete in {req.timeline} days by date {req.targetDate}.\n"
            "Keep the response professional, concise, and structured."
        )
        
        roadmap_report = "Milestone 1: Topic familiarity\nMilestone 2: Practical exercises\nMilestone 3: Review and self-assessment."
        
        # Call Groq/OpenAI if API keys exist
        groq_key, groq_model = get_groq_credentials_for_backend()
        openai_key = os.environ.get("OPENAI_API_KEY")
        
        try:
            if groq_key:
                client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
                response = client.chat.completions.create(
                    model=groq_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3
                )
                roadmap_report = response.choices[0].message.content.strip()
            elif openai_key and "dummy" not in openai_key:
                client = OpenAI(api_key=openai_key)
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3
                )
                roadmap_report = response.choices[0].message.content.strip()
        except Exception as api_err:
            print(f"[RevisionRouter] API roadmap generation failed: {api_err}. Using generic fallback.")

        # Create new Goal in Database
        new_goal = DBLearningGoal(
            id=int(time.time()),
            title=req.title,
            topics_json=json.dumps([t.strip() for t in req.topics.split(",")]),
            progress=0,
            deadline=req.targetDate,
            roadmap_report=roadmap_report
        )
        db.add(new_goal)
        
        # Update user weekly goal progress as visual feedback
        profile = db.query(DBUserProfile).filter(DBUserProfile.id == "demo-user").first()
        if profile:
            profile.weekly_goal_progress = min(profile.weekly_goal_progress + 5, 100)
            db.add(profile)
            
        db.commit()
            
        return {
            "success": True,
            "goal": {
                "id": new_goal.id,
                "title": new_goal.title,
                "subjects": new_goal.topics,
                "progress": new_goal.progress,
                "deadline": new_goal.deadline,
                "roadmapReport": new_goal.roadmap_report
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
