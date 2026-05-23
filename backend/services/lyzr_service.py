import json
from typing import Dict, Any, List, Optional
from openai import OpenAI
from backend.config import settings
from backend.services import qdrant_service

class LyzrAgent:
    def __init__(self, name: str, system_prompt: str):
        self.name = name
        self.system_prompt = system_prompt
        self.openai_client = None
        if settings.OPENAI_API_KEY and "dummy" not in settings.OPENAI_API_KEY:
            self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def execute(self, user_prompt: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Runs the agent prompt against OpenAI or returns a fallback response."""
        if not self.openai_client:
            return self.get_mock_fallback(user_prompt, context)
            
        try:
            messages = [
                {"role": "system", "content": self.system_prompt}
            ]
            if context:
                messages.append({
                    "role": "system", 
                    "content": f"Student Profile & Memory Context: {json.dumps(context)}"
                })
            messages.append({"role": "user", "content": user_prompt})
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.3
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Error executing agent {self.name}: {e}")
            return self.get_mock_fallback(user_prompt, context)

    def get_mock_fallback(self, prompt: str, context: Optional[Dict[str, Any]]) -> str:
        """Provides high-fidelity simulated responses for offline mode."""
        p_lower = prompt.lower()
        if "voice intent" in self.name.lower():
            # Return JSON intent classification
            if "quiz" in p_lower:
                return json.dumps({"intent": "QUIZ_REQUEST", "confidence": 0.95, "entities": {"topic": "Operating Systems"}})
            elif "explain" in p_lower or "what is" in p_lower:
                topic = "B+ Trees" if "tree" in p_lower else "Normalization"
                return json.dumps({"intent": "TUTORING_REQUEST", "confidence": 0.92, "entities": {"topic": topic}})
            elif "start recording" in p_lower or "record" in p_lower:
                return json.dumps({"intent": "LECTURE_START", "confidence": 0.96, "entities": {"subject": "DBMS"}})
            elif "stop" in p_lower or "end" in p_lower:
                return json.dumps({"intent": "LECTURE_STOP", "confidence": 0.94, "entities": {}})
            elif "weak" in p_lower or "struggle" in p_lower:
                return json.dumps({"intent": "WEAK_AREAS_QUERY", "confidence": 0.91, "entities": {}})
            elif "progress" in p_lower:
                return json.dumps({"intent": "PROGRESS_QUERY", "confidence": 0.93, "entities": {}})
            else:
                return json.dumps({"intent": "TUTORING_REQUEST", "confidence": 0.85, "entities": {"topic": prompt}})
                
        elif "tutor" in self.name.lower():
            if "tree" in p_lower:
                return (
                    "Think of B+ Trees like a library catalog index card filing system. "
                    "Instead of checking every book page (sequential scan), you look at the catalog tab 'History' -> 'Rome' -> 'Page 4'. "
                    "All actual books (data records) are stored at the bottom shelf (leaf nodes), while pointers at higher levels speed up navigation. "
                    "This guarantees O(log N) query time, making indexing extremely fast!"
                )
            elif "bcnf" in p_lower or "normalization" in p_lower:
                return (
                    "BCNF (Boyce-Codd Normal Form) is like a strict rule for roommates in a house. "
                    "It says: every decision maker (determinant) must be a master owner (superkey). "
                    "If roommate A determines Room B's chores, roommate A MUST own the house contract. "
                    "This prevents overlap anomalies where sub-agreements cause updates to conflict."
                )
            return f"Here is a tailored explanation for {prompt}. It uses analogies of filing cabinets to help connect new concepts with database normalization."
            
        elif "quiz" in self.name.lower():
            # Return list of quiz questions
            return json.dumps([
                {
                    "id": "q_dbms_1",
                    "question": "A relation R(A,B,C,D) has FDs: AB->C, C->D, D->A. What is the highest normal form of R?",
                    "options": ["1NF", "2NF", "3NF", "BCNF"],
                    "correct": 2,
                    "explanation": "Since D->A holds and D is not a superkey, BCNF is violated. However, no transitives exist on the primary key, so 3NF holds.",
                    "topic": "Normalization"
                },
                {
                    "id": "q_dbms_2",
                    "question": "In a B+ Tree index, where are the actual data pointers or record rows stored?",
                    "options": ["Root node only", "Internal nodes only", "Leaf nodes only", "All nodes evenly"],
                    "correct": 2,
                    "explanation": "Unlike B-Trees, B+ Trees store all actual record references or data rows exclusively in the leaf nodes.",
                    "topic": "Indexing"
                }
            ])
            
        elif "revision" in self.name.lower():
            return json.dumps({
                "due_today": ["Deadlock Prevention", "TLB Page Replacement"],
                "recommendation": "Prioritize Deadlock Prevention. Your memory retention is currently at 35% for this topic."
            })
            
        elif "graph" in self.name.lower():
            return json.dumps({
                "nodes": ["3NF", "BCNF", "Functional Dependencies", "ACID", "Serializability"],
                "dependencies": [
                    {"from": "Functional Dependencies", "to": "3NF"},
                    {"from": "3NF", "to": "BCNF"}
                ]
            })
            
        elif "analytics" in self.name.lower():
            return json.dumps({
                "examReadiness": 75,
                "strengths": ["ACID Properties", "SQL indexing"],
                "weaknesses": ["Deadlocks", "BCNF Normalization"]
            })
            
        return f"Response from {self.name} agent regarding: {prompt}"

# Instantiate agents
voice_intent_agent = LyzrAgent(
    name="Voice Intent Agent",
    system_prompt=(
        "You are the Voice Intent Agent. Classify user transcripts into JSON formats with keys: "
        "'intent' (one of: LECTURE_START, LECTURE_STOP, QUIZ_REQUEST, TUTORING_REQUEST, "
        "REVISION_START, ANALYTICS_QUERY, FLASHCARD_CREATE, ROADMAP_CREATE, GOAL_SET, "
        "WEAK_AREAS_QUERY, PROGRESS_QUERY, EXPLANATION_REQUEST, UNKNOWN), "
        "'confidence' (float 0.0 to 1.0), and 'entities' (dict of extracted parameters like topic, subject, goal)."
    )
)

lecture_processing_agent = LyzrAgent(
    name="Lecture Processing Agent",
    system_prompt=(
        "You are the Lecture Processing Agent. Take raw transcribed lecture audio text. "
        "Segment the content into semantic blocks, extract main topics, summarize each section, "
        "and suggest flashcards (front/back questions)."
    )
)

adaptive_tutor_agent = LyzrAgent(
    name="Adaptive Tutor Agent",
    system_prompt=(
        "You are the Adaptive Tutor Agent. Explain academic concepts using metaphors and analogies. "
        "Adjust explanations to match the student's learning preference (e.g. analogy-based, visual, code-heavy) "
        "which will be supplied in the context memory."
    )
)

quiz_intelligence_agent = LyzrAgent(
    name="Quiz Intelligence Agent",
    system_prompt=(
        "You are the Quiz Intelligence Agent. Generate adaptive multiple-choice questions "
        "or evaluate spoken user responses for correctness. Detect conceptual depth or misunderstandings."
    )
)

revision_planning_agent = LyzrAgent(
    name="Revision Planning Agent",
    system_prompt=(
        "You are the Revision Planning Agent. Optimize study schedules using spaced repetition "
        "rules (SM-2 forgetting curve). Determine due topics and revision tasks."
    )
)

knowledge_graph_agent = LyzrAgent(
    name="Knowledge Graph Agent",
    system_prompt=(
        "You are the Knowledge Graph Agent. Determine hierarchical connections between concepts. "
        "Identify prerequisites, parallel links, and construct learning paths."
    )
)

learning_analytics_agent = LyzrAgent(
    name="Learning Analytics Agent",
    system_prompt=(
        "You are the Learning Analytics Agent. Analyze student logs, quiz scores, timing, and hesitation "
        "metrics to compute readiness percentages, mastery curves, and identify at-risk topics."
    )
)

class MasterOrchestrator:
    def __init__(self):
        self.agents = {
            "intent": voice_intent_agent,
            "lecture": lecture_processing_agent,
            "tutor": adaptive_tutor_agent,
            "quiz": quiz_intelligence_agent,
            "revision": revision_planning_agent,
            "graph": knowledge_graph_agent,
            "analytics": learning_analytics_agent
        }

    def route_command(self, transcript: str, user_id: str = "demo-user") -> Dict[str, Any]:
        """Orchestrates user command routing: Classify intent -> Retrieve Memory -> Execute Specialized Agent."""
        # 1. Classify intent
        intent_json = self.agents["intent"].execute(transcript)
        try:
            intent_data = json.loads(intent_json)
        except Exception:
            intent_data = {"intent": "TUTORING_REQUEST", "confidence": 0.8, "entities": {"topic": transcript}}
            
        intent = intent_data.get("intent", "UNKNOWN")
        entities = intent_data.get("entities", {})
        
        # 2. Retrieve Qdrant memory context
        topic_query = entities.get("topic", transcript)
        memory_logs = qdrant_service.search_memory("tutoring_memory_collection", topic_query, user_id, limit=3)
        profile = qdrant_service.get_latest_cognitive_profile(user_id) or {
            "learningStyle": "Analogy-based",
            "weakTopics": {"Deadlock Prevention": 35},
            "masteryScores": {"DBMS": 67}
        }
        
        context = {
            "profile": profile,
            "recentMemory": memory_logs
        }
        
        # 3. Route to specialized agent
        response_text = ""
        agent_executed = "tutor"
        
        if intent in ["LECTURE_START", "LECTURE_STOP"]:
            agent_executed = "lecture"
            response_text = self.agents["lecture"].execute(f"Action: {intent} for topic: {entities.get('subject', 'DBMS')}", context)
        elif intent == "QUIZ_REQUEST":
            agent_executed = "quiz"
            response_text = self.agents["quiz"].execute(f"Generate quiz questions for: {entities.get('topic', 'DBMS')}", context)
        elif intent in ["REVISION_START", "WEAK_AREAS_QUERY"]:
            agent_executed = "revision"
            response_text = self.agents["revision"].execute(f"Prepare schedule for: {entities.get('topic', 'All')}", context)
        elif intent in ["ANALYTICS_QUERY", "PROGRESS_QUERY"]:
            agent_executed = "analytics"
            response_text = self.agents["analytics"].execute("Compute exam readiness and strengths", context)
        elif intent == "ROADMAP_CREATE":
            agent_executed = "graph"
            response_text = self.agents["graph"].execute(f"Generate learning roadmap for: {entities.get('topic', 'DBMS')}", context)
        else:
            # Fallback to tutoring response
            agent_executed = "tutor"
            response_text = self.agents["tutor"].execute(transcript, context)

        # 4. Save interaction to memory
        qdrant_service.store_memory(
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
        
        return {
            "intent": intent,
            "confidence": intent_data.get("confidence", 0.9),
            "entities": entities,
            "response": response_text,
            "agentExecuted": agent_executed
        }

master_orchestrator = MasterOrchestrator()
