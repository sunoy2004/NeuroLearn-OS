import json
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.config import settings

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class DBUserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(String, primary_key=True, index=True, default="demo-user")
    name = Column(String, default="Alex Chen")
    study_streak = Column(Integer, default=12)
    total_hours = Column(Integer, default=47)
    concepts_mastered = Column(Integer, default=38)
    exam_readiness = Column(Integer, default=73)
    weekly_goal_progress = Column(Integer, default=71)
    preferred_style = Column(String, default="Analogy-based")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DBLecture(Base):
    __tablename__ = "lectures"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    duration = Column(Integer, default=0) # in minutes
    concept_count = Column(Integer, default=0)
    flashcard_count = Column(Integer, default=0)
    topics_json = Column(Text, default="[]") # stored as json list
    date = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d"))

    @property
    def topics(self):
        try:
            return json.loads(self.topics_json)
        except Exception:
            return []

    @topics.setter
    def topics(self, value):
        self.topics_json = json.dumps(value)

class DBConcept(Base):
    __tablename__ = "concepts"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    mastery = Column(Float, default=50.0)
    retention = Column(Float, default=50.0)
    connections_json = Column(Text, default="[]") # JSON list of connected concept IDs
    last_reviewed = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d"))

    @property
    def connections(self):
        try:
            return json.loads(self.connections_json)
        except Exception:
            return []

    @connections.setter
    def connections(self, value):
        self.connections_json = json.dumps(value)

class DBQuizQuestion(Base):
    __tablename__ = "quiz_questions"
    
    id = Column(String, primary_key=True, index=True)
    question = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False) # JSON list
    correct = Column(Integer, nullable=False) # index of correct option
    explanation = Column(Text, nullable=True)
    topic = Column(String, nullable=False)

    @property
    def options(self):
        try:
            return json.loads(self.options_json)
        except Exception:
            return []

    @options.setter
    def options(self, value):
        self.options_json = json.dumps(value)

class DBFlashcard(Base):
    __tablename__ = "flashcards"
    
    id = Column(String, primary_key=True, index=True)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    topic = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    due_date = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d"))
    ease = Column(Float, default=2.5)
    interval = Column(Integer, default=1)
    review_count = Column(Integer, default=0)
    success_rate = Column(Float, default=0.0)

class DBWeakTopic(Base):
    __tablename__ = "weak_topics"
    
    name = Column(String, primary_key=True, index=True)
    subject = Column(String, nullable=False)
    score = Column(Float, default=50.0)
    days_until_forgetting = Column(Integer, default=3)
    trend = Column(String, default="stable") # stable, declining, improving

class DBRetentionPoint(Base):
    __tablename__ = "retention_points"
    
    date = Column(String, primary_key=True)
    retention = Column(Float, nullable=False)

class DBMasteryPoint(Base):
    __tablename__ = "mastery_points"
    
    subject = Column(String, primary_key=True)
    mastery = Column(Float, nullable=False)

def init_db():
    Base.metadata.create_all(bind=engine)
