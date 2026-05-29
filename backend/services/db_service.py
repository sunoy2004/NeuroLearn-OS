import json
from sqlalchemy.orm import Session
from backend.database import DBUserProfile

def seed_database(db: Session):
    # Check if already seeded
    if db.query(DBUserProfile).first():
        return
        
    print("Seeding SQLite database with initial empty profile...")
    
    # 1. Profile
    profile = DBUserProfile(
        id="demo-user",
        name="Learner",
        study_streak=0,
        total_hours=0,
        concepts_mastered=0,
        exam_readiness=0,
        weekly_goal_progress=0,
        preferred_style="Analogy-based",
        recommendations_json=json.dumps([]),
        insights_json=json.dumps([])
    )
    db.add(profile)
    db.commit()
    print("Database seeding completed.")

