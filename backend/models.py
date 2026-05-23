from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class UserProfileSchema(BaseModel):
    id: str
    name: str
    studyStreak: int
    totalHours: int
    conceptsMastered: int
    examReadiness: int
    weeklyGoalProgress: int
    preferredStyle: str

class LectureSchema(BaseModel):
    id: str
    title: str
    subject: str
    duration: int
    conceptCount: int
    flashcardCount: int
    topics: List[str]
    date: str

class ConceptSchema(BaseModel):
    id: str
    name: str
    subject: str
    mastery: float
    retention: float
    connections: List[str]
    lastReviewed: str

class QuizQuestionSchema(BaseModel):
    id: str
    question: str
    options: List[str]
    correct: int
    explanation: str
    topic: str

class FlashcardSchema(BaseModel):
    id: str
    front: str
    back: str
    topic: str
    subject: str
    dueDate: str
    ease: float
    interval: int

class WeakTopicSchema(BaseModel):
    name: str
    subject: str
    score: float
    daysUntilForgetting: int
    trend: str

class RetentionPointSchema(BaseModel):
    date: str
    retention: float

class MasteryPointSchema(BaseModel):
    subject: str
    mastery: float

class VoiceCommandRequest(BaseModel):
    transcript: str
    userId: Optional[str] = "demo-user"

class VoiceCommandResponse(BaseModel):
    id: str
    transcript: str
    intent: str
    confidence: float
    entities: Dict[str, str]
    response: str
    audioUrl: Optional[str] = None
    agentExecuted: str
    timestamp: float

class TutorChatRequest(BaseModel):
    message: str
    userId: Optional[str] = "demo-user"

class TutorChatResponse(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str
    agent: str
    thinkingSteps: Optional[List[str]] = None
