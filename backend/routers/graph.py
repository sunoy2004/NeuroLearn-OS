from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db, DBConcept

router = APIRouter(prefix="/api/graph", tags=["graph"])

@router.get("/concepts")
async def get_concept_graph(db: Session = Depends(get_db)):
    """Fetches all indexed concept nodes and their connections."""
    try:
        concepts = db.query(DBConcept).all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "subject": c.subject,
                "mastery": c.mastery,
                "retention": c.retention,
                "connections": c.connections,
                "lastReviewed": c.last_reviewed
            }
            for c in concepts
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
