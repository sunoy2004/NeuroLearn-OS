import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.config import settings
from backend.database import init_db, SessionLocal
from backend.services.db_service import seed_database
from backend.services.qdrant_service import initialize_qdrant, is_qdrant_available, qdrant_status

from backend.routers import voice, tutor, quiz, revision, analytics, graph, stack
from backend.scheduler.scheduler import start_scheduler, stop_scheduler

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

    async def _bootstrap_background():
        """Qdrant + scheduler must not block uvicorn from binding (Render health checks)."""
        try:
            await asyncio.to_thread(initialize_qdrant)
        except Exception as e:
            print(f"[Qdrant] bootstrap warning: {e}")
        try:
            start_scheduler()
        except Exception as e:
            print(f"[Scheduler] bootstrap warning: {e}")

    bootstrap_task = asyncio.create_task(_bootstrap_background())
    
    yield
    
    bootstrap_task.cancel()
    try:
        await bootstrap_task
    except asyncio.CancelledError:
        pass
    stop_scheduler()
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


@app.get("/health")
@app.get("/api/health")
def health_check():
    """Lightweight liveness probe — no Qdrant or external calls (use for Render health checks)."""
    return {
        "status": "ok",
        "service": "neurolearn-api",
        "qdrant_connected": is_qdrant_available(),
        "qdrant": qdrant_status(),
    }

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
