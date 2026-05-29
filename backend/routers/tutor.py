"""
Tutor Router — Adaptive AI Tutor with resilient fallback chain.

Flow: Lyzr Studio Agent → Direct Groq/OpenAI → Heuristic Fallback
Never returns raw 500 errors — always structured JSON.
"""

import time
import json
import traceback
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db, DBUserProfile
from backend.models import TutorChatRequest, TutorChatResponse
from backend.services import qdrant_service
from backend.services.agent_env import get_groq_credentials_for_backend

router = APIRouter(prefix="/api/tutor", tags=["tutor"])


# ─── Logging helpers ───

def _log(stage: str, msg: str, **kwargs):
    extra = " | ".join(f"{k}={v}" for k, v in kwargs.items()) if kwargs else ""
    print(f"[Tutor] [{stage}] {msg}" + (f" | {extra}" if extra else ""))


# ─── Fallback LLM chain ───

def _try_lyzr_tutor(message: str, context: Dict[str, Any]) -> Optional[str]:
    """Attempt 1: Lyzr Studio tutor agent — teaches any study topic from LLM knowledge."""
    try:
        from backend.services.llm_study_service import explain_study_topic
        _log("Lyzr", "Executing LLM-first tutor", message_len=len(message))
        result = explain_study_topic(message, context)
        if result and len(result.strip()) > 20:
            if not result.strip().lower().startswith('{"error"'):
                _log("Lyzr", "Success", response_len=len(result))
                return result
        _log("Lyzr", f"Empty or error response: {(result or '')[:100]}")
        return None
    except Exception as e:
        _log("Lyzr", f"Failed: {e}")
        return None


def _try_groq_tutor(message: str, context: Dict[str, Any]) -> Optional[str]:
    """Attempt 2: Direct Groq API call (bypasses Lyzr)."""
    try:
        groq_key, groq_model = get_groq_credentials_for_backend()
        if not groq_key:
            _log("Groq", "No Groq API key available — skipping")
            return None

        from openai import OpenAI
        client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")

        style = context.get("learningStyle", "Analogy-based") if context else "Analogy-based"
        system_prompt = (
            "You are the Adaptive Tutor Agent for NeuroLearn OS, an AI-native educational operating system.\n"
            "Your role is to explain academic concepts clearly and engagingly. You are a world-class teacher.\n\n"
            "Guidelines:\n"
            "- Use structured analogies and visual metaphors to make complex topics accessible\n"
            "- Break down explanations into logical steps\n"
            f"- Adapt your language to the student's learning style: {style}\n"
            "- Keep responses concise but thorough (2-4 paragraphs max)\n"
            "- If the student sends a greeting, respond warmly and offer to help with any subject\n"
            "- For explanations, follow: Definition → Simple Example → Real-World Analogy → Quick Check\n"
        )

        messages = [
            {"role": "system", "content": system_prompt},
        ]
        if context:
            memories = context.get("relevantPastInteractions", [])
            if memories:
                mem_text = json.dumps(memories[:2], default=str)[:500]
                messages.append({"role": "system", "content": f"Recent student context: {mem_text}"})
        messages.append({"role": "user", "content": message})

        _log("Groq", "Calling Groq API", model=groq_model, message_len=len(message))
        response = client.chat.completions.create(
            model=groq_model,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        result = response.choices[0].message.content.strip()
        _log("Groq", "Success", response_len=len(result))
        return result
    except Exception as e:
        _log("Groq", f"Failed: {e}")
        return None


def _try_agent_tutor(message: str, context: Dict[str, Any]) -> Optional[str]:
    """Attempt: agent_service TutorAgent via injected LLM."""
    try:
        from agent_service.providers.agent_provider_factory import get_agent_llm
        from agent_service.agents.tutor_agent import TutorAgent

        agent = TutorAgent(get_agent_llm("tutor"))
        result = agent.execute(message, context)
        if result and len(result.strip()) > 30 and "[Adaptive Tutor Agent] LLM execution failed" not in result:
            _log("AgentTutor", "Success", response_len=len(result))
            return result
        return None
    except Exception as e:
        _log("AgentTutor", f"Failed: {e}")
        return None


def _try_lyzr_direct_chat(message: str) -> Optional[str]:
    """Attempt 3: Direct Lyzr chat API (simplified, no context)."""
    try:
        from backend.services.lyzr_client import get_agent_lyzr_credentials, is_lyzr_configured, lyzr_chat
        api_key, agent_id = get_agent_lyzr_credentials("TUTOR")
        if not is_lyzr_configured(api_key, agent_id):
            return None
        _log("LyzrDirect", "Trying direct chat API")
        result = lyzr_chat(api_key, agent_id, message)
        if result:
            _log("LyzrDirect", "Success", response_len=len(result))
            return result
        return None
    except Exception as e:
        _log("LyzrDirect", f"Failed: {e}")
        return None


def _heuristic_response(message: str) -> str:
    """Last-resort fallback when all LLM providers are unavailable."""
    msg_lower = message.lower().strip()

    greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "how are you"]
    for g in greetings:
        if msg_lower.startswith(g):
            return (
                "Hello! I'm your NeuroLearn Adaptive Tutor. I can explain any study topic — "
                "from Agent AI to data structures, DBMS, or anything academic. "
                "What would you like to learn about today?"
            )

    return (
        "I'm having trouble reaching the AI tutoring engine right now. "
        "Please ensure the backend is running and your Lyzr API keys are configured in `.env`, "
        "then try again. I can teach any academic topic once connected."
    )


# ─── Resilient Qdrant helpers ───

def _safe_search_memory(collection: str, query: str, user_id: str, limit: int = 2):
    """Search Qdrant memory with graceful fallback."""
    try:
        return qdrant_service.search_memory(collection, query, user_id, limit)
    except Exception as e:
        _log("Qdrant", f"search_memory failed: {e}")
        return []


def _safe_store_memory(collection: str, payload: dict, text: str):
    """Store to Qdrant with graceful fallback."""
    try:
        qdrant_service.store_memory(collection, payload, text)
    except Exception as e:
        _log("Qdrant", f"store_memory failed: {e}")


# ─── Routes ───

@router.get("/health")
async def tutor_health():
    """Health check for the tutor service — reports provider status."""
    health = {
        "healthy": False,
        "provider": "unknown",
        "model": "unknown",
        "lyzr_configured": False,
        "groq_available": False,
        "qdrant_connected": False,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

    # Check Lyzr
    try:
        from backend.services.lyzr_service import adaptive_tutor_agent
        health["lyzr_configured"] = adaptive_tutor_agent.configured
        if health["lyzr_configured"]:
            health["provider"] = "lyzr"
            health["model"] = "gpt-4o-mini"
            health["healthy"] = True
    except Exception:
        pass

    # Check Groq
    try:
        groq_key, groq_model = get_groq_credentials_for_backend()
        if groq_key:
            health["groq_available"] = True
            if not health["healthy"]:
                health["provider"] = "groq"
                health["model"] = groq_model
                health["healthy"] = True
    except Exception:
        pass

    # Check Qdrant
    try:
        client = qdrant_service.get_qdrant_client()
        if client:
            health["qdrant_connected"] = True
    except Exception:
        pass

    # If neither Lyzr nor Groq, heuristic fallback still works
    if not health["healthy"]:
        health["provider"] = "heuristic"
        health["model"] = "keyword-based"
        health["healthy"] = True  # heuristic always works

    return health


@router.post("/chat", response_model=TutorChatResponse)
async def chat_with_tutor(req: TutorChatRequest, db: Session = Depends(get_db)):
    """
    Chat with the Adaptive Tutor. Uses a resilient fallback chain:
    Lyzr Agent → Groq Direct → Lyzr Direct → Heuristic
    Never returns 500 — always structured JSON response.
    """
    start_time = time.time()
    provider_used = "unknown"
    error_detail = None

    _log("Request", "Incoming chat",
         user_id=req.userId, message_len=len(req.message),
         message_preview=req.message[:80])

    try:
        # 1. Fetch user profile
        profile = None
        preferred_style = "Analogy-based"
        try:
            profile = db.query(DBUserProfile).filter(DBUserProfile.id == req.userId).first()
            if profile:
                preferred_style = profile.preferred_style or "Analogy-based"
        except Exception as e:
            _log("Profile", f"DB query failed: {e}")

        # 2. Optional local lecture context (enrichment only — not required)
        memories = _safe_search_memory(
            "tutoring_memory_collection", req.message, req.userId, limit=2
        )
        local_context = ""
        try:
            from backend.services.revision_content_service import gather_lecture_context_for_topic
            ctx = gather_lecture_context_for_topic(req.message, db)
            if ctx.get("has_local_context"):
                parts = [p for p in [ctx.get("notes"), ctx.get("summary")] if p]
                local_context = "\n".join(parts)[:4000]
        except Exception as e:
            _log("Context", f"Optional lecture context skipped: {e}")

        context = {
            "userId": req.userId,
            "learningStyle": preferred_style,
            "relevantPastInteractions": memories,
            "localLectureContext": local_context or None,
        }

        # 3. Build thinking steps
        thinking_steps = [
            "Analyzing your question...",
            f"Retrieved {len(memories)} relevant past interactions from memory.",
            f"Adapting to learning style: '{preferred_style}'.",
        ]
        if local_context:
            thinking_steps.append("Found related local lecture notes to supplement the explanation.")
        else:
            thinking_steps.append("Teaching from expert knowledge (no local notes required).")

        # 4. Execute fallback chain
        response_text = None

        # Attempt 1: Lyzr Studio Agent
        response_text = _try_lyzr_tutor(req.message, context)
        if response_text:
            provider_used = "lyzr"
            thinking_steps.append("Response generated via Lyzr Adaptive Tutor Agent.")

        # Attempt 2: Direct Groq API
        if not response_text:
            response_text = _try_groq_tutor(req.message, context)
            if response_text:
                provider_used = "groq"
                thinking_steps.append("Response generated via Groq LLM (direct).")

        # Attempt 3: agent_service TutorAgent (Lyzr/Groq via agent factory)
        if not response_text:
            response_text = _try_agent_tutor(req.message, context)
            if response_text:
                provider_used = "tutor-agent"
                thinking_steps.append("Response generated via Tutor Agent LLM pipeline.")

        # Attempt 4: Lyzr Direct Chat (simplified)
        if not response_text:
            response_text = _try_lyzr_direct_chat(req.message)
            if response_text:
                provider_used = "lyzr-direct"
                thinking_steps.append("Response generated via Lyzr direct chat API.")

        # Attempt 5: Heuristic fallback
        if not response_text:
            response_text = _heuristic_response(req.message)
            provider_used = "heuristic"
            thinking_steps.append("Using offline heuristic response (LLM providers unavailable).")

        # 5. Store conversation in Qdrant (non-blocking)
        _safe_store_memory(
            "tutoring_memory_collection",
            {
                "userId": req.userId,
                "question": req.message,
                "explanation": response_text[:500],
                "learningStyle": preferred_style,
                "provider": provider_used,
                "timestamp": time.time(),
            },
            f"Question: {req.message}\nAnswer: {response_text}"
        )

        # 6. Update profile stats
        try:
            if profile and len(req.message) % 3 == 0:
                profile.concepts_mastered = min(profile.concepts_mastered + 1, 45)
                db.commit()
        except Exception as e:
            _log("Profile", f"Update failed: {e}")

        elapsed = time.time() - start_time
        _log("Response", "Success",
             provider=provider_used, elapsed_ms=f"{elapsed*1000:.0f}",
             response_len=len(response_text))

        return TutorChatResponse(
            id=f"tutor-{int(time.time()*1000)}",
            role="assistant",
            content=response_text,
            timestamp=datetime.utcnow().isoformat() + "Z",
            agent=f"Adaptive Tutor ({provider_used})",
            thinkingSteps=thinking_steps,
        )

    except Exception as e:
        elapsed = time.time() - start_time
        error_detail = str(e)
        _log("Error", f"Unhandled exception: {error_detail}",
             traceback=traceback.format_exc()[:500],
             elapsed_ms=f"{elapsed*1000:.0f}")

        # Even on unexpected errors, return a structured response — NEVER 500
        fallback_text = _heuristic_response(req.message)
        return TutorChatResponse(
            id=f"tutor-err-{int(time.time()*1000)}",
            role="assistant",
            content=fallback_text,
            timestamp=datetime.utcnow().isoformat() + "Z",
            agent="Adaptive Tutor (offline)",
            thinkingSteps=[
                "Tutor service encountered an issue.",
                f"Error: {error_detail[:100]}",
                "Using offline fallback response.",
            ],
        )
