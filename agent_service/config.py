import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List

base_dir = Path(__file__).resolve().parent.parent
env_file_path = base_dir / ".env"

class Settings(BaseSettings):
    # Global fallback provider settings
    LLM_PROVIDER: str = "local"
    VOICE_PROVIDER: str = "omi"
    MEMORY_PROVIDER: str = "qdrant"
    ORCHESTRATOR_PROVIDER: str = "local"

    # Omi Voice
    OMI_UID: str = ""
    OMI_DEEPGRAM_API_KEY: str = ""
    OMI_LISTEN_URL: str = "wss://api.omi.me/v4/listen"

    # ─── ORCHESTRATOR AGENT ───
    ORCHESTRATOR_AGENT_PROVIDER: str = "lyzr"
    ORCHESTRATOR_AGENT_API_KEY: str = ""
    ORCHESTRATOR_AGENT_MODEL: str = "llama-3.3-70b-versatile"
    ORCHESTRATOR_AGENT_TEMPERATURE: float = 0.2
    ORCHESTRATOR_AGENT_STREAMING: bool = True
    ORCHESTRATOR_AGENT_LYZR_ID: str = ""

    # ─── LECTURE AGENT ───
    LECTURE_AGENT_PROVIDER: str = "lyzr"
    LECTURE_AGENT_API_KEY: str = ""
    LECTURE_AGENT_LYZR_ID: str = ""
    LECTURE_AGENT_MODEL: str = "llama-3.3-70b-versatile"
    LECTURE_AGENT_TEMPERATURE: float = 0.3
    LECTURE_AGENT_STREAMING: bool = True

    # ─── NOTES AGENT ───
    NOTES_AGENT_PROVIDER: str = "lyzr"
    NOTES_AGENT_API_KEY: str = ""
    NOTES_AGENT_LYZR_ID: str = ""
    NOTES_AGENT_MODEL: str = "llama-3.3-70b-versatile"
    NOTES_AGENT_TEMPERATURE: float = 0.4
    NOTES_AGENT_STREAMING: bool = True

    # ─── FLASHCARD AGENT ───
    FLASHCARD_AGENT_PROVIDER: str = "lyzr"
    FLASHCARD_AGENT_API_KEY: str = ""
    FLASHCARD_AGENT_LYZR_ID: str = ""
    FLASHCARD_AGENT_MODEL: str = "llama-3.1-8b-instant"
    FLASHCARD_AGENT_TEMPERATURE: float = 0.5
    FLASHCARD_AGENT_STREAMING: bool = True

    # ─── QUIZ AGENT ───
    QUIZ_AGENT_PROVIDER: str = "lyzr"
    QUIZ_AGENT_API_KEY: str = ""
    QUIZ_AGENT_LYZR_ID: str = ""
    QUIZ_AGENT_MODEL: str = "llama-3.3-70b-versatile"
    QUIZ_AGENT_TEMPERATURE: float = 0.6
    QUIZ_AGENT_STREAMING: bool = True

    # ─── TUTOR AGENT ───
    TUTOR_AGENT_PROVIDER: str = "lyzr"
    TUTOR_AGENT_API_KEY: str = ""
    TUTOR_AGENT_LYZR_ID: str = ""
    TUTOR_AGENT_MODEL: str = "llama-3.3-70b-versatile"
    TUTOR_AGENT_TEMPERATURE: float = 0.7
    TUTOR_AGENT_STREAMING: bool = True

    # ─── ANALYTICS AGENT ───
    ANALYTICS_AGENT_PROVIDER: str = "lyzr"
    ANALYTICS_AGENT_API_KEY: str = ""
    ANALYTICS_AGENT_LYZR_ID: str = ""
    ANALYTICS_AGENT_MODEL: str = "llama-3.1-8b-instant"
    ANALYTICS_AGENT_TEMPERATURE: float = 0.2
    ANALYTICS_AGENT_STREAMING: bool = False

    # ─── KNOWLEDGE GRAPH AGENT ───
    KNOWLEDGE_GRAPH_AGENT_PROVIDER: str = "lyzr"
    KNOWLEDGE_GRAPH_AGENT_API_KEY: str = ""
    KNOWLEDGE_GRAPH_AGENT_LYZR_ID: str = ""
    KNOWLEDGE_GRAPH_AGENT_MODEL: str = "llama-3.3-70b-versatile"
    KNOWLEDGE_GRAPH_AGENT_TEMPERATURE: float = 0.4
    KNOWLEDGE_GRAPH_AGENT_STREAMING: bool = True

    # Global API keys (optional — per-agent keys are preferred)
    OPENAI_API_KEY: str = ""
    LYZR_BASE_URL: str = "https://agent-prod.studio.lyzr.ai"
    DEEPGRAM_API_KEY: str = ""
    ELEVEN_LABS_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"

    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""

    HOST: str = "0.0.0.0"
    AGENT_PORT: int = 8001
    CORS_ORIGINS: List[str] = ["*"]

    class Config:
        env_file = str(env_file_path) if env_file_path.exists() else ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

for key, value in settings.model_dump().items():
    if isinstance(value, (str, int, float, bool)) and value != "":
        os.environ[key] = str(value)
