import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # API Keys
    OPENAI_API_KEY: str = "dummy-openai-key-replace-me"
    LYZR_API_KEY: str = "dummy-lyzr-key-replace-me"
    DEEPGRAM_API_KEY: str = "dummy-deepgram-key-replace-me"
    ELEVEN_LABS_API_KEY: str = "dummy-elevenlabs-key-replace-me"
    
    # Qdrant Database Settings
    # If empty, runs in local storage (in-memory/SQLite vector client)
    QDRANT_URL: str = ""
    QDRANT_API_KEY: str = ""
    
    # Relational Database Settings
    DATABASE_URL: str = "sqlite:///./neurolearn.db"
    
    # Application Config
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = ["*"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
