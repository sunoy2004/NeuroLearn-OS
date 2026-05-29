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
    """Attempt 1: Lyzr Studio tutor agent."""
    try:
        from backend.services.lyzr_service import adaptive_tutor_agent
        if not adaptive_tutor_agent.configured:
            _log("Lyzr", "Agent not configured — skipping")
            return None
        _log("Lyzr", "Executing tutor agent", message_len=len(message))
        result = adaptive_tutor_agent.execute(message, context)
        if result and "error" not in result.lower()[:50]:
            _log("Lyzr", "Success", response_len=len(result))
            return result
        _log("Lyzr", f"Agent returned error-like response: {result[:100]}")
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
    """Attempt 4: Heuristic fallback — no LLM needed."""
    msg_lower = message.lower().strip()

    # Greetings
    greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "how are you"]
    for g in greetings:
        if msg_lower.startswith(g):
            return (
                "Hello! 👋 I'm your NeuroLearn Adaptive Tutor. I'm here to help you understand "
                "any academic concept — from data structures to operating systems. "
                "What would you like to learn about today?"
            )

    # Educational questions
    if any(kw in msg_lower for kw in ["explain", "what is", "define", "teach me", "how does", "why does"]):
        topic = message.strip().rstrip("?").split()[-2:] if len(message.split()) > 2 else [message.strip()]
        topic_str = " ".join(topic)
        return (
            f"Great question about {topic_str}! While my advanced AI tutoring engine is "
            "temporarily connecting, here's what I recommend:\n\n"
            f"1. **Start a lecture** on {topic_str} to build your knowledge base\n"
            "2. **Generate flashcards** to reinforce key concepts\n"
            "3. **Take a quiz** to test your understanding\n\n"
            "The AI tutor will provide detailed explanations once the connection is restored. "
            "In the meantime, try recording a lecture!"
        )

    return (
        "I received your message, but my AI tutoring engine is temporarily unavailable. "
        "I'll be back online shortly! In the meantime, you can:\n\n"
        "• Record a lecture to build your knowledge graph\n"
        "• Review your flashcards in the Revision Center\n"
        "• Check your learning analytics\n\n"
        "Please try again in a moment."
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

        # 2. Retrieve semantic context from Qdrant (non-blocking)
        memories = _safe_search_memory(
            "tutoring_memory_collection", req.message, req.userId, limit=2
        )

        context = {
            "userId": req.userId,
            "learningStyle": preferred_style,
            "relevantPastInteractions": memories,
        }

        # 3. Build thinking steps
        thinking_steps = [
            "Analyzing your question...",
            f"Retrieved {len(memories)} relevant past interactions from memory.",
            f"Adapting to learning style: '{preferred_style}'.",
        ]

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

        # Attempt 3: Lyzr Direct Chat (simplified)
        if not response_text:
            response_text = _try_lyzr_direct_chat(req.message)
            if response_text:
                provider_used = "lyzr-direct"
                thinking_steps.append("Response generated via Lyzr direct chat API.")

        # Attempt 4: Heuristic fallback
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
