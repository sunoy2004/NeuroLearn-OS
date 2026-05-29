"""
DistributedOrchestrator — Multi-agent pipeline with confidence gating.

Pipeline: Intent Classifier → Confidence Gate → Agent Router → Specialist Executor

This replaces the monolithic LyzrAgent-based AgentOrchestrator.
Each specialist agent gets its own LLM instance via the AgentProviderFactory.
"""

import json
import time
from typing import Dict, Any, Tuple

from agent_service.agents.intent_agent import IntentAgent
from agent_service.agents.tutor_agent import TutorAgent
from agent_service.agents.quiz_agent import QuizAgent
from agent_service.agents.lecture_agent import LectureAgent
from agent_service.agents.summary_agent import SummaryAgent
from agent_service.agents.navigation_agent import NavigationAgent
from agent_service.agents.flashcard_agent import FlashcardAgent
from agent_service.agents.notes_agent import NotesAgent
from agent_service.agents.analytics_agent import AnalyticsAgent
from agent_service.agents.knowledge_graph_agent import KnowledgeGraphAgent
from agent_service.orchestrator.intent_validator import validate_intent
from agent_service.providers.agent_provider_factory import get_agent_llm
from agent_service.tools.registry import tool_registry, AgentAction
from agent_service.events.bus import event_bus
from backend.database import SessionLocal, DBFlashcard, DBLecture, DBUserProfile
from datetime import datetime
import uuid


class DistributedOrchestrator:
    """
    Multi-agent orchestrator with confidence-gated intent routing.
    
    Flow:
    1. IntentAgent classifies the transcript → {intent, confidence, entities}
    2. IntentValidator gates the intent → reject if confidence < 0.6
    3. Router dispatches to the correct SpecialistAgent
    4. SpecialistAgent generates the response
    5. Memory logs the interaction
    """

    def __init__(self, memory_provider):
        self.memory = memory_provider

        # Initialize specialist agents with per-agent LLM isolation
        self.intent_agent = IntentAgent(llm=get_agent_llm("intent"))
        self.tutor_agent = TutorAgent(llm=get_agent_llm("tutor"))
        self.quiz_agent = QuizAgent(llm=get_agent_llm("quiz"))
        self.lecture_agent = LectureAgent(llm=get_agent_llm("lecture"))
        self.summary_agent = SummaryAgent(llm=get_agent_llm("summary"))
        self.navigation_agent = NavigationAgent(llm=get_agent_llm("navigation"))
        self.flashcard_agent = FlashcardAgent(llm=get_agent_llm("flashcard"))
        self.notes_agent = NotesAgent(llm=get_agent_llm("notes"))
        self.analytics_agent = AnalyticsAgent(llm=get_agent_llm("analytics"))
        self.knowledge_graph_agent = KnowledgeGraphAgent(llm=get_agent_llm("knowledge_graph"))

        # Global Orchestrator Memory
        self.active_workflow = "dashboard"
        self.active_lecture_id = ""
        self.active_lecture_title = ""
        self.active_transcript = []
        self.active_tutor_context = {}
        self.active_revision_context = {
            "mode": "idle",
            "questions": [],
            "current_index": 0,
            "topic": "",
            "score": 0
        }

        print("[DistributedOrchestrator] All specialist agents initialized.")

    def get_agent_registry(self) -> list:
        """Return current agent status for frontend registry."""
        from agent_service.providers.agent_provider_factory import AgentProviderFactory
        return AgentProviderFactory.get_all_health()

    def append_transcript_chunk(self, chunk: str, lecture_id: str = "") -> None:
        """Persist transcript chunk and trigger downstream agents."""
        if lecture_id:
            self.active_lecture_id = lecture_id
        self.active_transcript.append(chunk)
        event_bus.publish("transcript_updated", {
            "lecture_id": self.active_lecture_id,
            "chunk": chunk,
            "total_length": len(self.active_transcript),
        })

        # Rolling notes generation every ~500 words
        compiled = " ".join(self.active_transcript)
        if len(compiled.split()) >= 80 and len(compiled.split()) % 80 < 20:
            try:
                notes = self.notes_agent.generate_notes(compiled)
                event_bus.publish("notes_generated", {
                    "lecture_id": self.active_lecture_id,
                    "notes": notes[:500],
                    "partial": True,
                })
            except Exception as e:
                print(f"[Orchestrator] Rolling notes generation failed: {e}")

    def process_command(self, transcript: str, user_id: str = "demo-user") -> Tuple[str, str, Any]:
        """
        Process a voice command through the distributed agent pipeline.
        
        Returns: (intent_name, text_response, agent_action)
        """
        # Instant greeting fallbacks to avoid LLM delays and misclassifications
        lower_msg = transcript.lower().strip()
        if "good morning" in lower_msg:
            response_text = "Good morning! Ready for another learning session? What topic would you like to explore today?"
            self._log_command(user_id, transcript, "GREETING", response_text, "tutor")
            return "GREETING", response_text, AgentAction(action="none")
        elif any(x in lower_msg for x in ["hello", "hi", "hey"]):
            response_text = "Hello! I'm your Neural Learn study companion. I can help explain concepts, generate quizzes, create revision notes, analyze lectures, and guide your learning. What would you like to study today?"
            self._log_command(user_id, transcript, "GREETING", response_text, "tutor")
            return "GREETING", response_text, AgentAction(action="none")

        # Check if we are in interactive quiz mode
        if self.active_revision_context.get("mode") == "interactive_quiz":
            questions = self.active_revision_context.get("questions", [])
            idx = self.active_revision_context.get("current_index", 0)
            
            if idx < len(questions):
                q = questions[idx]
                correct_idx = q.get("correct", 0)
                options = q.get("options", [])
                correct_answer = options[correct_idx] if options else "correct answer"
                
                # Evaluate user answer using LLM
                eval_prompt = (
                    f"Quiz Question: {q.get('question')}\n"
                    f"Correct Answer: {correct_answer}\n"
                    f"Student Answer: {transcript}\n\n"
                    f"Evaluate the student's answer. State clearly if they are correct, partially correct, or incorrect, "
                    f"and provide a very brief 1-2 sentence explanation of the reasoning."
                )
                evaluation_text = self.tutor_agent.execute(eval_prompt)
                
                # Update score if correct
                is_correct = "correct" in evaluation_text.lower() and "incorrect" not in evaluation_text.lower()
                if is_correct:
                    self.active_revision_context["score"] += 1
                
                # Advance to next question
                next_idx = idx + 1
                self.active_revision_context["current_index"] = next_idx
                
                if next_idx < len(questions):
                    next_q = questions[next_idx]
                    next_options = next_q.get("options", [])
                    next_options_str = f" Options: {', '.join(next_options)}" if next_options else ""
                    response_text = (
                        f"{evaluation_text}\n\n"
                        f"Moving to Question {next_idx + 1}: {next_q.get('question')}{next_options_str}"
                    )
                    action = AgentAction(action="none")
                else:
                    score = self.active_revision_context["score"]
                    total = len(questions)
                    response_text = (
                        f"{evaluation_text}\n\n"
                        f"Interactive voice quiz complete! You scored {score} out of {total}. "
                        f"Great work reinforcing your knowledge!"
                    )
                    self.active_revision_context["mode"] = "idle"
                    action = tool_registry.execute_tool("navigate", target="revision")
                
                self._log_command(user_id, transcript, "QUIZ_ANSWER", response_text, "quiz")
                return "QUIZ_ANSWER", response_text, action

        # ─── Stage 1: Intent Classification ───
        intent_data = self.intent_agent.classify(transcript)
        intent = intent_data.get("intent", "UNKNOWN")
        confidence = intent_data.get("confidence", 0.0)
        entities = intent_data.get("entities", {})

        print(f"[Orchestrator] Intent: {intent} | Confidence: {confidence:.2f} | Entities: {entities}")

        # ─── Stage 2: Confidence Gating ───
        is_valid, rejection_reason = validate_intent(intent_data, transcript)

        if not is_valid:
            print(f"[Orchestrator] Intent REJECTED: {rejection_reason}")
            self._log_command(user_id, transcript, "REJECTED", rejection_reason, "gate")
            return "REJECTED", rejection_reason, AgentAction(action="none")

        # ─── Stage 3: Agent Routing & Execution ───
        response_text = ""
        action = AgentAction(action="none")
        agent_executed = "orchestrator"

        # Retrieve memory context for agents that need it
        context = self._build_context(user_id, transcript, entities)

        if intent == "LECTURE_START":
            agent_executed = "lecture"
            subject = entities.get("subject", "DBMS")
            self.active_workflow = "lecture-studio"
            self.active_lecture_id = f"lec_{uuid.uuid4().hex[:8]}"
            self.active_transcript = []
            response_text = self.lecture_agent.coordinate_start(subject)
            action = tool_registry.execute_tool("start_recording", subject=subject)

        elif intent == "LECTURE_STOP":
            agent_executed = "lecture"
            response_text = self.lecture_agent.coordinate_stop()
            action = tool_registry.execute_tool("stop_recording")

        elif intent == "FLASHCARD_CREATE":
            agent_executed = "flashcard"
            compiled_transcript = " ".join(self.active_transcript)
            subject = entities.get("subject", "DBMS")
            
            # Fallback to recent database lecture notes if no active transcript
            if not compiled_transcript or len(compiled_transcript.strip()) < 15:
                db = SessionLocal()
                try:
                    recent_lec = db.query(DBLecture).order_by(DBLecture.date.desc()).first()
                    if recent_lec and recent_lec.notes:
                        compiled_transcript = recent_lec.notes
                        subject = recent_lec.subject
                        self.active_lecture_id = recent_lec.id
                except Exception as e:
                    print(f"Error querying recent lecture for flashcards: {e}")
                finally:
                    db.close()
                    
            if not compiled_transcript or len(compiled_transcript.strip()) < 15:
                response_text = "I couldn't find an active lecture transcript or notes to generate flashcards from. Please start a lecture first."
                action = AgentAction(action="none")
            else:
                cards = self.flashcard_agent.generate_cards(compiled_transcript, self.active_lecture_id)
                if not cards:
                    response_text = "I tried to generate flashcards, but no distinct academic concepts were extracted. Please try again with more detailed lecture content."
                    action = AgentAction(action="none")
                else:
                    db = SessionLocal()
                    try:
                        for card in cards:
                            db_fc = DBFlashcard(
                                id=card["id"],
                                front=card["front"],
                                back=card["back"],
                                topic=card["topic"],
                                subject=subject,
                                due_date=datetime.utcnow().strftime("%Y-%m-%d"),
                                ease=2.5,
                                interval=1
                            )
                            db.add(db_fc)
                        db.commit()
                        response_text = f"I've successfully generated {len(cards)} new spaced-repetition flashcards on {subject}. They are ready for you in the Revision Center."
                        event_bus.publish("flashcards_generated", {"flashcards": cards, "subject": subject})
                        self.active_workflow = "revision"
                        action = tool_registry.execute_tool("navigate", target="revision")
                    except Exception as e:
                        db.rollback()
                        response_text = f"An error occurred while saving the flashcards: {e}"
                        action = AgentAction(action="none")
                    finally:
                        db.close()

        elif intent == "QUIZ_REQUEST":
            agent_executed = "quiz"
            topic = entities.get("topic") or "General"
            if topic == "General" and transcript:
                # Try to extract topic from transcript
                for phrase in ("on ", "about ", "for "):
                    if phrase in transcript.lower():
                        parts = transcript.lower().split(phrase, 1)
                        if len(parts) > 1:
                            topic = parts[1].strip().rstrip(".!?")[:60].title()
                            break

            quiz_result = []
            db = SessionLocal()
            try:
                from backend.services.revision_content_service import generate_quiz_for_topic
                quiz_result = generate_quiz_for_topic(
                    topic=topic, db=db, count=10, force_regenerate=True
                )
            except Exception as e:
                print(f"[Orchestrator] Quiz generation via revision service failed: {e}")
            finally:
                db.close()

            if quiz_result:
                event_bus.publish("quiz_generated", {"topic": topic, "questions": quiz_result, "count": len(quiz_result)})

                is_interactive = any(x in transcript.lower() for x in ["interactive", "voice", "talk to me", "quiz me"])
                if is_interactive:
                    self.active_revision_context = {
                        "mode": "interactive_quiz",
                        "questions": quiz_result,
                        "current_index": 0,
                        "topic": topic,
                        "score": 0
                    }
                    q0 = quiz_result[0]
                    opts = q0.get("options", [])
                    opts_str = f" Options: {', '.join(opts)}" if opts else ""
                    response_text = f"Starting interactive quiz on {topic}! Question 1: {q0.get('question')}{opts_str}"
                    action = AgentAction(action="none")
                else:
                    response_text = f"I've generated {len(quiz_result)} quiz questions on {topic} from your lecture materials."
                    self.active_workflow = "revision"
                    action = tool_registry.execute_tool("open_quiz", topic=topic)
            else:
                event_bus.publish("quiz_generated", {"topic": topic})
                response_text = f"Generating quiz on {topic} — opening Revision Center."
                self.active_workflow = "revision"
                action = tool_registry.execute_tool("open_quiz", topic=topic)

        elif intent in ("REVISION_START", "WEAK_AREAS_QUERY"):
            agent_executed = "navigation"
            self.active_workflow = "revision"
            response_text = "Opening the revision center to review your spaced repetition flashcards."
            action = tool_registry.execute_tool("navigate", target="revision")

        elif intent in ("ANALYTICS_QUERY", "PROGRESS_QUERY"):
            agent_executed = "navigation"
            self.active_workflow = "analytics"
            response_text = "Opening the learning analytics page to inspect your cognitive profile."
            action = tool_registry.execute_tool("navigate", target="analytics")

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
            self.active_workflow = target
            response_text = f"Navigating to {target.replace('-', ' ').title()}."
            action = tool_registry.execute_tool("navigate", target=target)

        elif intent in ("TUTORING_REQUEST", "EXPLANATION_REQUEST"):
            agent_executed = "tutor"
            self.active_workflow = "tutor"
            response_text = self.tutor_agent.explain(transcript, context)
            action = tool_registry.execute_tool("navigate", target="tutor")

        elif intent == "GREETING":
            agent_executed = "tutor"
            response_text = self.tutor_agent.greet(transcript, context)
            action = AgentAction(action="none")

        elif intent == "EDUCATIONAL_QUESTION":
            agent_executed = "tutor"
            self.active_workflow = "tutor"
            response_text = self.tutor_agent.teach(transcript, context)
            action = tool_registry.execute_tool("navigate", target="tutor")

        elif intent == "GENERAL_CONVERSATION":
            agent_executed = "tutor"
            response_text = self.tutor_agent.execute(transcript, context)
            action = AgentAction(action="none")

        else:
            # Confidence was >= 0.6 but intent is unrecognized — ask for clarification
            agent_executed = "orchestrator"
            response_text = (
                "I heard you, but I'm not sure what action to take. "
                "You can ask me to explain a concept, start a quiz, record a lecture, or navigate to a page."
            )
            action = AgentAction(action="none")

        # ─── Stage 4: Memory Logging ───
        self._log_command(user_id, transcript, intent, response_text, agent_executed)
        event_bus.publish("agent_status", {
            "agent_id": agent_executed,
            "status": "complete",
            "current_task": f"Completed: {intent}",
        })

        return intent, response_text, action

    def _build_context(self, user_id: str, transcript: str, entities: Dict) -> Dict[str, Any]:
        """Build execution context from memory for specialist agents."""
        try:
            topic_query = entities.get("topic", transcript)
            recent_memory = self.memory.search_memory(
                "tutoring_memory_collection", topic_query, user_id, limit=2
            )
            profile = self.memory.get_latest_cognitive_profile(user_id) or {
                "learningStyle": "Analogy-based"
            }
            
            # Fetch user learning profile from DB
            learning_profile = {}
            db = SessionLocal()
            try:
                user_profile = db.query(DBUserProfile).filter(DBUserProfile.id == user_id).first()
                if user_profile and user_profile.learning_profile_json:
                    learning_profile = json.loads(user_profile.learning_profile_json)
            except Exception as db_ex:
                print(f"[Orchestrator] Database profile query failed: {db_ex}")
            finally:
                db.close()
                
            return {
                "profile": profile,
                "recentMemory": recent_memory,
                "learning_profile": learning_profile
            }
        except Exception as e:
            print(f"[Orchestrator] Memory context failed: {e}")
            return {"profile": {"learningStyle": "Analogy-based"}, "recentMemory": [], "learning_profile": {}}

    def _log_command(self, user_id: str, transcript: str, intent: str, response: str, agent: str):
        """Persist the command interaction to memory."""
        try:
            self.memory.store_memory(
                collection_name="voice_command_collection",
                payload={
                    "userId": user_id,
                    "transcript": transcript,
                    "intent": intent,
                    "response": response[:500],
                    "agentExecuted": agent,
                    "timestamp": time.time()
                },
                text_to_embed=transcript
            )
        except Exception as e:
            print(f"[Orchestrator] Memory log failed: {e}")
