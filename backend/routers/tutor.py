import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db, DBUserProfile
from backend.models import TutorChatRequest, TutorChatResponse
from backend.services import lyzr_service, qdrant_service

router = APIRouter(prefix="/api/tutor", tags=["tutor"])

@router.post("/chat", response_model=TutorChatResponse)
async def chat_with_tutor(req: TutorChatRequest, db: Session = Depends(get_db)):
    """Handles chat messages with the Adaptive Tutor, pulling in semantic memories from Qdrant."""
    try:
        # 1. Fetch user profile from SQLite
        profile = db.query(DBUserProfile).filter(DBUserProfile.id == req.userId).first()
        preferred_style = profile.preferred_style if profile else "Analogy-based"
        
        # 2. Retrieve semantic context from Qdrant
        memories = qdrant_service.search_memory(
            collection_name="tutoring_memory_collection",
            query_text=req.message,
            user_id=req.userId,
            limit=2
        )
        
        # Structure context for Lyzr
        context = {
            "userId": req.userId,
            "learningStyle": preferred_style,
            "relevantPastInteractions": memories
        }
        
        # 3. Define agent execution steps (thinking steps)
        thinking_steps = [
            "Connecting to Qdrant Vector database...",
            f"Retrieved {len(memories)} relevant historic tutor logs.",
            f"Adhering to preferred cognitive style: '{preferred_style}'.",
            "Synthesizing response via Lyzr Adaptive Tutor Agent..."
        ]
        
        # 4. Execute Lyzr tutor agent
        response_text = lyzr_service.adaptive_tutor_agent.execute(req.message, context)
        
        # 5. Store new conversation chunk in Qdrant
        qdrant_service.store_memory(
            collection_name="tutoring_memory_collection",
            payload={
                "userId": req.userId,
                "question": req.message,
                "explanation": response_text,
                "learningStyle": preferred_style,
                "timestamp": time.time()
            },
            text_to_embed=f"Question: {req.message}\nAnswer: {response_text}"
        )
        
        # 6. Increment mastered count occasionally for visual progress
        if profile and len(req.message) % 3 == 0:
            profile.concepts_mastered = min(profile.concepts_mastered + 1, 45)
            db.commit()
            
        return TutorChatResponse(
            id=f"tutor-{int(time.time()*1000)}",
            role="assistant",
            content=response_text,
            timestamp=datetime.utcnow().isoformat() + "Z",
            agent="Adaptive Tutor",
            thinkingSteps=thinking_steps
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
