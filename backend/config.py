import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List

# Resolve the absolute path to .env in the parent workspace directory
base_dir = Path(__file__).resolve().parent.parent
env_file_path = base_dir / ".env"

class Settings(BaseSettings):
    LYZR_BASE_URL: str = "https://agent-prod.studio.lyzr.ai"

    # Omi Voice (uses Deepgram STT — same engine as api.omi.me)
    OMI_UID: str = ""
    OMI_DEEPGRAM_API_KEY: str = ""
    OMI_LISTEN_URL: str = "wss://api.omi.me/v4/listen"
    DEEPGRAM_API_KEY: str = ""

    # Qdrant vector memory
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    MEMORY_PROVIDER: str = "qdrant"
    VOICE_PROVIDER: str = "omi"

    # Optional voice/vector keys (infrastructure)
    OPENAI_API_KEY: str = ""
    ELEVEN_LABS_API_KEY: str = ""
    
    # Relational Database Settings
    DATABASE_URL: str = "sqlite:///./neurolearn.db"
    
    # Application Config
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = ["*"]
    
    class Config:
        env_file = str(env_file_path) if env_file_path.exists() else ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

# Force load setting attributes into os.environ so other modules and library SDKs can read them
for key, value in settings.model_dump().items():
    if isinstance(value, (str, int, float, bool)) and value != "":
        os.environ[key] = str(value)


