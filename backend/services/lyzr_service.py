"""
Lyzr multi-agent orchestration — each specialist is a Lyzr Studio agent.
Routes voice commands through intent classification → Qdrant memory → specialist agents.
"""

import json
import time
from typing import Any, Dict, Optional

from backend.services import qdrant_service
from backend.services.lyzr_client import (
    get_agent_lyzr_credentials,
    is_lyzr_configured,
    lyzr_agent_execute,
)
from backend.database import SessionLocal, DBUserProfile

# ─── Agent system prompts (mirror Lyzr Studio agent instructions) ───

INTENT_PROMPT = """You are the Voice Intent Classifier for NeuroLearn OS.
Respond ONLY with raw JSON (no markdown): {"intent": "...", "confidence": 0.0-1.0, "entities": {}}
Allowed intents: LECTURE_START, LECTURE_STOP, QUIZ_REQUEST, TUTORING_REQUEST, REVISION_START,
ANALYTICS_QUERY, FLASHCARD_CREATE, ROADMAP_CREATE, GOAL_SET, WEAK_AREAS_QUERY, PROGRESS_QUERY,
EXPLANATION_REQUEST, NAVIGATE_DASHBOARD, NAVIGATE_TUTOR, NAVIGATE_LECTURE, NAVIGATE_REVISION,
NAVIGATE_ANALYTICS, NAVIGATE_GRAPH, UNKNOWN
Navigation: "open revision" → NAVIGATE_REVISION, "open knowledge graph" → NAVIGATE_GRAPH, etc.
Multilingual input is supported — JSON keys stay English."""

LECTURE_PROMPT = """You are the Lecture Processing Agent. Handle lecture start/stop actions and
summarize lecture content into topics and flashcard suggestions."""

TUTOR_PROMPT = """You are the Adaptive Tutor Agent for NeuroLearn OS. Explain academic concepts using
analogies and clear definitions. Adapt to the student's learning style from context memory."""

QUIZ_PROMPT = """You are the Quiz Intelligence Agent. Generate adaptive multiple-choice questions as JSON
array with keys: id, question, options, correct (index), explanation, topic. Or evaluate answers."""

REVISION_PROMPT = """You are the Revision Planning Agent. Optimize spaced repetition schedules and
recommend due topics as JSON: {"due_today": [...], "recommendation": "..."}."""

GRAPH_PROMPT = """You are the Knowledge Graph Agent. Return concept relationships as JSON:
{"nodes": [...], "dependencies": [{"from": "...", "to": "..."}]}."""

ANALYTICS_PROMPT = """You are the Learning Analytics Agent. Return JSON with examReadiness, strengths,
weaknesses based on student context."""


class LyzrStudioAgent:
    """Thin wrapper around a Lyzr Studio agent ID."""

    def __init__(self, name: str, env_prefix: str, system_prompt: str):
        self.name = name
        self.env_prefix = env_prefix
        self.system_prompt = system_prompt

    @property
    def configured(self) -> bool:
        key, aid = get_agent_lyzr_credentials(self.env_prefix)
        return is_lyzr_configured(key, aid)

    def is_healthy(self) -> bool:
        """Check if this agent can reach the Lyzr API."""
        if not self.configured:
            return False
        try:
            result = self.execute("ping", None)
            return result is not None and "error" not in result.lower()[:50]
        except Exception:
            return False

    def execute(self, user_prompt: str, context: Optional[Dict[str, Any]] = None) -> str:
        if not self.configured:
            return json.dumps({
                "error": f"{self.name} not configured",
                "hint": f"Set {self.env_prefix}_AGENT_LYZR_ID in .env",
            })
        try:
            return lyzr_agent_execute(
                self.env_prefix, self.name, self.system_prompt, user_prompt, context
            )
        except Exception as e:
            print(f"[LyzrService] {self.name} failed: {e}")
            return json.dumps({"error": str(e)})


# ─── Multi-agent registry (Lyzr Studio — one agent per role) ───

voice_intent_agent = LyzrStudioAgent("Voice Intent Agent", "ORCHESTRATOR", INTENT_PROMPT)
lecture_processing_agent = LyzrStudioAgent("Lecture Processing Agent", "LECTURE", LECTURE_PROMPT)
adaptive_tutor_agent = LyzrStudioAgent("Adaptive Tutor Agent", "TUTOR", TUTOR_PROMPT)
quiz_intelligence_agent = LyzrStudioAgent("Quiz Intelligence Agent", "QUIZ", QUIZ_PROMPT)
revision_planning_agent = LyzrStudioAgent("Revision Planning Agent", "NOTES", REVISION_PROMPT)
knowledge_graph_agent = LyzrStudioAgent("Knowledge Graph Agent", "KNOWLEDGE_GRAPH", GRAPH_PROMPT)
learning_analytics_agent = LyzrStudioAgent("Learning Analytics Agent", "ANALYTICS", ANALYTICS_PROMPT)


class MasterOrchestrator:
    """Lyzr multi-agent orchestrator with Qdrant semantic memory."""

    def __init__(self):
        self.agents = {
            "intent": voice_intent_agent,
            "lecture": lecture_processing_agent,
            "tutor": adaptive_tutor_agent,
            "quiz": quiz_intelligence_agent,
            "revision": revision_planning_agent,
            "graph": knowledge_graph_agent,
            "analytics": learning_analytics_agent,
        }

    def get_agent_status(self) -> list:
        return [
            {
                "name": agent.name,
                "env_prefix": agent.env_prefix,
                "configured": agent.configured,
                "provider": "lyzr",
            }
            for agent in self.agents.values()
        ]

    def route_command(self, transcript: str, user_id: str = "demo-user") -> Dict[str, Any]:
        # Instant greeting fallbacks to avoid LLM delays
        lower_msg = transcript.lower().strip()
        if "good morning" in lower_msg:
            return {
                "intent": "GREETING",
                "confidence": 1.0,
                "entities": {},
                "response": "Good morning! Ready for another learning session? What topic would you like to explore today?",
                "agentExecuted": "tutor",
            }
        elif any(x in lower_msg for x in ["hello", "hi", "hey"]):
            return {
                "intent": "GREETING",
                "confidence": 1.0,
                "entities": {},
                "response": "Hello! I'm your Neural Learn study companion. I can help explain concepts, generate quizzes, create revision notes, analyze lectures, and guide your learning. What would you like to study today?",
                "agentExecuted": "tutor",
            }

        # 1. Lyzr intent classification
        intent_json = self.agents["intent"].execute(transcript)
        try:
            clean = intent_json.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[-1]
            if clean.endswith("```"):
                clean = clean.rsplit("```", 1)[0]
            intent_data = json.loads(clean.strip())
        except Exception:
            intent_data = {"intent": "TUTORING_REQUEST", "confidence": 0.75, "entities": {"topic": transcript}}

        intent = intent_data.get("intent", "UNKNOWN")
        entities = intent_data.get("entities", {}) or {}

        # 2. Qdrant semantic memory
        topic_query = entities.get("topic", transcript)
        memory_logs = qdrant_service.search_memory("tutoring_memory_collection", topic_query, user_id, limit=3)
        profile = qdrant_service.get_latest_cognitive_profile(user_id) or {
            "learningStyle": "Analogy-based",
        }
        
        # Fetch user learning profile from DB
        learning_profile = {}
        db = SessionLocal()
        try:
            user_profile = db.query(DBUserProfile).filter(DBUserProfile.id == user_id).first()
            if user_profile and user_profile.learning_profile_json:
                learning_profile = json.loads(user_profile.learning_profile_json)
        except Exception as db_ex:
            print(f"[LyzrService] Database profile query failed: {db_ex}")
        finally:
            db.close()
            
        context = {"profile": profile, "recentMemory": memory_logs, "learning_profile": learning_profile}

        # 3. Route to Lyzr specialist agent
        response_text = ""
        agent_executed = "tutor"

        if intent in ("LECTURE_START", "LECTURE_STOP"):
            agent_executed = "lecture"
            response_text = self.agents["lecture"].execute(
                f"Action: {intent} for subject: {entities.get('subject', 'General')}", context
            )
        elif intent == "QUIZ_REQUEST":
            agent_executed = "quiz"
            response_text = self.agents["quiz"].execute(
                f"Generate quiz for topic: {entities.get('topic', 'General')}", context
            )
        elif intent in ("REVISION_START", "WEAK_AREAS_QUERY", "FLASHCARD_CREATE"):
            agent_executed = "revision"
            response_text = self.agents["revision"].execute(
                f"Prepare revision for: {entities.get('topic', 'all topics')}", context
            )
        elif intent in ("ANALYTICS_QUERY", "PROGRESS_QUERY"):
            agent_executed = "analytics"
            response_text = self.agents["analytics"].execute("Compute exam readiness and strengths", context)
        elif intent in ("ROADMAP_CREATE", "NAVIGATE_GRAPH") or intent.startswith("NAVIGATE_GRAPH"):
            agent_executed = "graph"
            response_text = self.agents["graph"].execute(
                f"Build concept map for: {entities.get('topic', 'current subject')}", context
            )
        elif intent.startswith("NAVIGATE_"):
            agent_executed = "navigation"
            target_map = {
                "NAVIGATE_DASHBOARD": "dashboard",
                "NAVIGATE_TUTOR": "tutor",
                "NAVIGATE_LECTURE": "lecture-studio",
                "NAVIGATE_REVISION": "revision",
                "NAVIGATE_ANALYTICS": "analytics",
                "NAVIGATE_GRAPH": "knowledge-graph",
            }
            target = target_map.get(intent, "dashboard")
            response_text = f"Navigating to {target.replace('-', ' ')}."
        else:
            agent_executed = "tutor"
            response_text = self.agents["tutor"].execute(transcript, context)

        # 4. Persist to Qdrant
        qdrant_service.store_memory(
            collection_name="voice_command_collection",
            payload={
                "userId": user_id,
                "transcript": transcript,
                "intent": intent,
                "response": response_text[:500],
                "agentExecuted": agent_executed,
                "timestamp": time.time(),
            },
            text_to_embed=transcript,
        )

        return {
            "intent": intent,
            "confidence": float(intent_data.get("confidence", 0.85)),
            "entities": entities,
            "response": response_text,
            "agentExecuted": agent_executed,
        }


master_orchestrator = MasterOrchestrator()
