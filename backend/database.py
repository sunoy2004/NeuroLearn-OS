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
    name = Column(String, default="Learner")
    study_streak = Column(Integer, default=0)
    total_hours = Column(Integer, default=0)
    concepts_mastered = Column(Integer, default=0)
    concepts_detected = Column(Integer, default=0)
    exam_readiness = Column(Integer, default=0)
    weekly_goal_progress = Column(Integer, default=0)
    preferred_style = Column(String, default="Analogy-based")
    recommendations_json = Column(Text, default="[]") # JSON list of strings
    insights_json = Column(Text, default="[]") # JSON list of strings
    learning_profile_json = Column(Text, default="{}")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DBLecture(Base):
    __tablename__ = "lectures"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    category = Column(String, nullable=True, default="General")
    duration = Column(Integer, default=0) # in minutes
    concept_count = Column(Integer, default=0)
    flashcard_count = Column(Integer, default=0)
    topics_json = Column(Text, default="[]") # stored as json list
    keywords_json = Column(Text, default="[]") # extracted keywords
    summary = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    language = Column(String, default="auto")
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

class DBLearningGoal(Base):
    __tablename__ = "learning_goals"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    topics_json = Column(Text, default="[]")
    progress = Column(Integer, default=0)
    deadline = Column(String, nullable=False)
    roadmap_report = Column(Text, nullable=True)

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
    definition = Column(Text, nullable=True)
    importance = Column(String, default="Medium")
    related_concepts_json = Column(Text, default="[]")
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
    difficulty = Column(String, default="Medium")
    question_type = Column(String, default="MCQ")

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

class DBTranscriptChunk(Base):
    __tablename__ = "transcript_chunks"

    id = Column(String, primary_key=True, index=True)
    lecture_id = Column(String, index=True, nullable=False)
    text = Column(Text, nullable=False)
    chunk_type = Column(String, default="speech")
    timestamp = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class DBQuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(String, primary_key=True, index=True)
    question_id = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    selected_answer = Column(Integer, nullable=False)
    correct = Column(Boolean, default=False)
    score = Column(Float, default=0.0)
    attempted_at = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))

def init_db():
    Base.metadata.create_all(bind=engine)
    # Safe migration — add new columns without breaking existing databases
    migrations = [
        "ALTER TABLE lectures ADD COLUMN language VARCHAR DEFAULT 'auto'",
        "ALTER TABLE lectures ADD COLUMN category VARCHAR DEFAULT 'General'",
        "ALTER TABLE lectures ADD COLUMN keywords_json TEXT DEFAULT '[]'",
        "ALTER TABLE user_profiles ADD COLUMN concepts_detected INTEGER DEFAULT 0",
        "ALTER TABLE user_profiles ADD COLUMN learning_profile_json TEXT DEFAULT '{}'",
        "ALTER TABLE concepts ADD COLUMN definition TEXT",
        "ALTER TABLE concepts ADD COLUMN importance VARCHAR DEFAULT 'Medium'",
        "ALTER TABLE concepts ADD COLUMN related_concepts_json TEXT DEFAULT '[]'",
        "ALTER TABLE quiz_questions ADD COLUMN difficulty VARCHAR DEFAULT 'Medium'",
        "ALTER TABLE quiz_questions ADD COLUMN question_type VARCHAR DEFAULT 'MCQ'",
    ]
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            for sql in migrations:
                try:
                    conn.execute(text(sql))
                except Exception:
                    pass  # column already exists
            conn.commit()
    except Exception:
        pass
