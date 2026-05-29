import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.config import settings
from backend.database import init_db, SessionLocal
from backend.services.db_service import seed_database
from backend.services.qdrant_service import initialize_qdrant

from backend.routers import voice, tutor, quiz, revision, analytics, graph, stack

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize SQLite Database Tables
    init_db()
    
    # 2. Seed SQLite Database with Initial Data
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
        
    # 3. Bootstrap Qdrant Collections
    initialize_qdrant()
    
    yield
    
    # Shutdown logic (if any)
    print("NeuroLearn OS backend server shutting down.")

app = FastAPI(
    title="NeuroLearn OS - Production-Grade Agentic Backend",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend API calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register REST Routers
app.include_router(voice.router)
app.include_router(tutor.router)
app.include_router(quiz.router)
app.include_router(revision.router)
app.include_router(analytics.router)
app.include_router(graph.router)
app.include_router(stack.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to NeuroLearn OS Production Agentic API Server"}

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
