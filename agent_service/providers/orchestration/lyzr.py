import json
import time
from typing import Tuple, Dict, Any, Optional
from agent_service.providers.interfaces.orchestrator import OrchestratorProvider
from agent_service.tools.registry import tool_registry, AgentAction
from agent_service.config import settings

class LyzrAgentShim:
    """Shim representing a Lyzr agent, executing using the active LLM provider."""
    def __init__(self, name: str, system_prompt: str, llm_provider):
        self.name = name
        self.system_prompt = system_prompt
        self.llm = llm_provider

    def execute(self, user_prompt: str, context: Optional[Dict[str, Any]] = None) -> str:
        messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        return self.llm.chat(messages=[{"role": "user", "content": user_prompt}], context=context)

class LyzrOrchestratorProvider(OrchestratorProvider):
    def __init__(self, llm_provider, memory_provider):
        self.llm = llm_provider
        self.memory = memory_provider
        
        # Initialize agents using LLM provider
        self.intent_agent = LyzrAgentShim(
            name="Voice Intent Agent",
            system_prompt=(
                "You are the Voice Intent Agent. Classify user transcripts into JSON formats with keys: "
                "'intent' (one of: LECTURE_START, LECTURE_STOP, QUIZ_REQUEST, TUTORING_REQUEST, "
                "REVISION_START, ANALYTICS_QUERY, FLASHCARD_CREATE, ROADMAP_CREATE, GOAL_SET, "
                "WEAK_AREAS_QUERY, PROGRESS_QUERY, EXPLANATION_REQUEST, UNKNOWN), "
                "'confidence' (float 0.0 to 1.0), and 'entities' (dict of extracted parameters like topic, subject, goal)."
            ),
            llm_provider=llm_provider
        )
        
        self.tutor_agent = LyzrAgentShim(
            name="Adaptive Tutor Agent",
            system_prompt=(
                "You are the Adaptive Tutor Agent. Explain academic concepts using structured analogies, visual metaphors, "
                "and clear technical definitions. Adapt to the student's learning style."
            ),
            llm_provider=llm_provider
        )

    def process_command(self, transcript: str, user_id: str = "demo-user") -> Tuple[str, str, Any]:
        # 1. Extract Intent
        intent_json = self.intent_agent.execute(transcript)
        try:
            # Clean JSON responses from LLM wraps
            clean_json = intent_json.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            intent_data = json.loads(clean_json.strip())
        except Exception:
            intent_data = {"intent": "TUTORING_REQUEST", "confidence": 0.8, "entities": {"topic": transcript}}
            
        intent = intent_data.get("intent", "UNKNOWN")
        entities = intent_data.get("entities", {})
        
        # 2. Retrieve memory context from memory provider
        topic_query = entities.get("topic", transcript)
        recent_memory = self.memory.search_memory("tutoring_memory_collection", topic_query, user_id, limit=3)
        profile = self.memory.get_latest_cognitive_profile(user_id) or {
            "learningStyle": "Analogy-based"
        }
        
        context = {
            "profile": profile,
            "recentMemory": recent_memory
        }

        # 3. Route execution & generate tools
        response_text = ""
        action = AgentAction(action="none")
        agent_executed = "tutor"

        if intent == "LECTURE_START":
            agent_executed = "lecture"
            subject = entities.get("subject", "DBMS")
            response_text = f"Initializing lecture recording for {subject}. The microphone stream is now active."
            action = tool_registry.execute_tool("start_recording", subject=subject)
            
        elif intent == "LECTURE_STOP":
            agent_executed = "lecture"
            response_text = "Stopping lecture recording. I am compiling the transcript and initializing the post-lecture summarization pipeline."
            action = tool_registry.execute_tool("stop_recording")
            
        elif intent == "QUIZ_REQUEST":
            agent_executed = "quiz"
            topic = entities.get("topic", "DBMS")
            response_text = f"Navigating to the revision center and opening your quiz session on {topic}."
            action = tool_registry.execute_tool("open_quiz", topic=topic)
            
        elif intent in ["REVISION_START", "WEAK_AREAS_QUERY"]:
            agent_executed = "navigation"
            response_text = "Opening the revision center to review your spaced repetition flashcards and goals."
            action = tool_registry.execute_tool("navigate", target="revision")
            
        elif intent in ["ANALYTICS_QUERY", "PROGRESS_QUERY"]:
            agent_executed = "navigation"
            response_text = "Opening the learning analytics page to inspect your cognitive profile progress."
            action = tool_registry.execute_tool("navigate", target="analytics")
            
        elif intent == "TUTORING_REQUEST" or intent == "EXPLANATION_REQUEST":
            agent_executed = "tutor"
            response_text = self.tutor_agent.execute(transcript, context)
            action = tool_registry.execute_tool("navigate", target="tutor")
            
        else:
            agent_executed = "tutor"
            response_text = self.tutor_agent.execute(transcript, context)
            action = tool_registry.execute_tool("navigate", target="tutor")

        # 4. Save to Memory provider
        self.memory.store_memory(
            collection_name="voice_command_collection",
            payload={
                "userId": user_id,
                "transcript": transcript,
                "intent": intent,
                "response": response_text,
                "agentExecuted": agent_executed,
                "timestamp": time.time()
            },
            text_to_embed=transcript
        )
        
        return intent, response_text, action
