import json
import base64
import time
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from agent_service.config import settings
from agent_service.providers import factory
from agent_service.providers.agent_provider_factory import get_agent_llm, AgentProviderFactory
from agent_service.agents.bootstrap import bootstrap_agents, AgentBootstrap
from agent_service.agents.lecture_agent import LectureAgent
from agent_service.events.bus import event_bus

_lecture_agent: LectureAgent = None


def _get_lecture_agent() -> LectureAgent:
    global _lecture_agent
    if _lecture_agent is None:
        bootstrap = AgentBootstrap.get_instance()
        agent = bootstrap.get_agent("lecture")
        if agent:
            _lecture_agent = agent
        else:
            _lecture_agent = LectureAgent(llm=get_agent_llm("lecture"))
    return _lecture_agent


@asynccontextmanager
async def lifespan(app: FastAPI):
    factory.get_memory_provider().initialize()
    agent_health = bootstrap_agents()
    print(f"Agent Service startup complete. {len([a for a in agent_health if a.get('enabled')])} agents active on port {settings.AGENT_PORT}")
    yield
    print("Agent Service shutting down.")

app = FastAPI(
    title="Neural Learn OS - Autonomous Agent Service",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for API gateway access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/agents/health")
def get_agents_health():
    """Return distributed agent health — provider, model, streaming, no API keys."""
    return {
        "agents": AgentProviderFactory.get_all_health(),
        "active_count": sum(1 for a in AgentProviderFactory.get_all_health() if a.get("enabled")),
    }


@app.post("/agents/reload")
def reload_agents():
    """Hot-reload agent configs from .env without full restart."""
    health = AgentBootstrap.get_instance().reload()
    return {"status": "reloaded", "agents": health}


@app.get("/")
def read_root():
    return {
        "service": "Neural Learn OS Autonomous Agent Service",
        "status": "online",
        "port": settings.AGENT_PORT,
        "architecture": "distributed-multi-agent",
        "providers": {
            "llm": settings.LLM_PROVIDER,
            "voice": settings.VOICE_PROVIDER,
            "memory": settings.MEMORY_PROVIDER,
            "orchestrator": settings.ORCHESTRATOR_PROVIDER
        }
    }


async def _process_and_respond(websocket: WebSocket, transcript: str):
    """Shared pipeline: orchestrate → stream tokens → TTS → send result."""
    orchestrator = factory.get_orchestrator_provider()
    intent, response_text, action = orchestrator.process_command(transcript, "demo-user")

    print(f"[AgentService] Intent: {intent} | Response: {response_text[:80]}...")

    # Stream start event
    await websocket.send_json({
        "event": "stream_start",
        "transcript": transcript,
        "intent": intent,
        "agentExecuted": intent.lower()
    })

    # True token-by-token streaming using agent's isolated LLM stream
    if intent in ("TUTORING_REQUEST", "EXPLANATION_REQUEST"):
        tutor_llm = get_agent_llm("tutor")
        tutor_config = AgentProviderFactory.get_config("tutor")
        if tutor_config.streaming and hasattr(tutor_llm, "stream"):
            messages = [
                {"role": "system", "content": "You are an adaptive AI tutor for NeuroLearn OS."},
                {"role": "user", "content": transcript},
            ]
            for token in tutor_llm.stream(messages):
                await websocket.send_json({"event": "stream_chunk", "chunk": token})
                await asyncio.sleep(0.01)
        else:
            words = response_text.split(" ")
            for i, word in enumerate(words):
                await websocket.send_json({
                    "event": "stream_chunk",
                    "chunk": word + (" " if i < len(words) - 1 else "")
                })
                await asyncio.sleep(0.02)
    else:
        # For short action responses, send as a single chunk
        await websocket.send_json({
            "event": "stream_chunk",
            "chunk": response_text
        })

    # Generate TTS vocal reply
    voice_provider = factory.get_voice_provider()
    audio_bytes = await voice_provider.text_to_speech(response_text)
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else ""
    audio_url = f"data:audio/wav;base64,{audio_base64}" if audio_base64 else ""

    # Build final result payload
    action_dict = action.dict() if hasattr(action, "dict") else (action if isinstance(action, dict) else {"action": "none"})
    payload = {
        "event": "result",
        "transcript": transcript,
        "intent": intent,
        "response": response_text,
        "audioUrl": audio_url,
        "agentExecuted": intent.lower(),
        "action": action_dict
    }
    event_bus.publish("agent_action_completed", payload)
    await websocket.send_json(payload)


@app.websocket("/ws/agent-stream")
async def websocket_agent_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time binary audio capture and conversational action loops."""
    await websocket.accept()
    
    # Send connection config handshake with actual provider info
    orchestrator = factory.get_orchestrator_provider()
    agent_list = AgentProviderFactory.get_all_health()

    await websocket.send_json({
        "event": "config",
        "voice_provider": settings.VOICE_PROVIDER,
        "llm_provider": settings.LLM_PROVIDER,
        "memory_provider": settings.MEMORY_PROVIDER,
        "orchestrator_provider": settings.ORCHESTRATOR_PROVIDER,
        "agents": agent_list,
        "agent_health": agent_list,
    })
    
    # Subscribe to Event Bus channels for real-time frontend pushing
    loop = asyncio.get_running_loop()

    def make_event_forwarder(event_name: str):
        def forwarder(data: dict):
            asyncio.run_coroutine_threadsafe(
                websocket.send_json({
                    "event": event_name,
                    **data
                }),
                loop
            )
        return forwarder

    channels = [
        "transcript_updated", "flashcards_generated", "notes_generated",
        "analytics_updated", "graph_updated", "tutor_response", "quiz_generated",
        "agent_status", "lecture_started",
    ]
    subscriptions = {}
    for chan in channels:
        cb = make_event_forwarder(chan)
        event_bus.subscribe(chan, cb)
        subscriptions[chan] = cb
        
    audio_buffer = bytearray()
    print(f"WebSocket client connected. Providers: LLM={settings.LLM_PROVIDER}, Voice={settings.VOICE_PROVIDER}")
    
    try:
        while True:
            message = await websocket.receive()
            
            if "bytes" in message:
                audio_buffer.extend(message["bytes"])
                
            elif "text" in message:
                text_data = message["text"]
                
                if text_data == "clear":
                    audio_buffer.clear()
                    
                elif text_data == "process_recording":
                    if len(audio_buffer) == 0:
                        await websocket.send_json({
                            "event": "error",
                            "message": "No audio received"
                        })
                        continue
                        
                    # Transcribe audio using configured voice provider
                    voice_provider = factory.get_voice_provider()
                    print(f"Streaming audio captured ({len(audio_buffer)} bytes). Transcribing...")
                    transcript = await voice_provider.speech_to_text(bytes(audio_buffer))
                    audio_buffer.clear()
                    print(f"Transcribed Text: {transcript}")
                    
                    # Process through distributed orchestrator pipeline
                    await _process_and_respond(websocket, transcript)
                    
                else:
                    # Handle JSON text commands
                    try:
                        cmd_data = json.loads(text_data)

                        if cmd_data.get("type") == "ping":
                            await websocket.send_json({"event": "pong"})
                            continue

                        if cmd_data.get("type") == "lecture_chunk":
                            chunk_text = cmd_data.get("text", "")
                            lecture_id = cmd_data.get("lecture_id", "")

                            orchestrator = factory.get_orchestrator_provider()
                            if hasattr(orchestrator, "_get_orchestrator"):
                                dist_orch = orchestrator._get_orchestrator()
                                dist_orch.append_transcript_chunk(chunk_text, lecture_id)

                            # LLM-powered concept detection via LectureAgent + keyword merge
                            lecture_agent = _get_lecture_agent()
                            detected_concepts: list = []
                            try:
                                detected_concepts = await asyncio.to_thread(
                                    lecture_agent.detect_concepts, chunk_text
                                )
                            except Exception as e:
                                print(f"[AgentService] LLM concept detection failed: {e}")

                            for concept in _keyword_concept_fallback(chunk_text):
                                if concept not in detected_concepts:
                                    detected_concepts.append(concept)

                            if detected_concepts:
                                event_bus.publish("graph_updated", {
                                    "concepts": detected_concepts,
                                    "lecture_id": lecture_id,
                                })

                            for concept in detected_concepts:
                                print(f"[AgentService] Concept detected in lecture: {concept}")
                                await websocket.send_json({
                                    "event": "concept_detected",
                                    "concept": concept,
                                    "timestamp": time.time()
                                })
                            continue

                        if cmd_data.get("type") == "lecture_start":
                            orchestrator = factory.get_orchestrator_provider()
                            if hasattr(orchestrator, "_get_orchestrator"):
                                dist_orch = orchestrator._get_orchestrator()
                                dist_orch.active_lecture_id = cmd_data.get("lecture_id", f"lec_{int(time.time())}")
                                dist_orch.active_transcript = []
                                dist_orch.active_workflow = "lecture-studio"
                            event_bus.publish("lecture_started", {"lecture_id": cmd_data.get("lecture_id")})
                            continue

                        if cmd_data.get("type") == "text_command":
                            transcript = cmd_data.get("transcript", "")
                            await _process_and_respond(websocket, transcript)

                    except Exception as parse_ex:
                        print(f"Error handling JSON text command: {parse_ex}")
                        
    except WebSocketDisconnect:
        print("WebSocket client disconnected from Agent Service.")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Clean up Event Bus subscriptions on disconnect
        for chan, cb in subscriptions.items():
            if chan in event_bus.local_handlers:
                try:
                    event_bus.local_handlers[chan].remove(cb)
                except ValueError:
                    pass
        try:
            await websocket.close()
        except:
            pass


def _keyword_concept_fallback(chunk_text: str) -> list:
    """Fallback keyword-based concept detection when LLM is unavailable."""
    from concept_keywords import extract_concepts_from_text
    return extract_concepts_from_text(chunk_text, max_concepts=6)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "agent_service.main:app",
        host=settings.HOST,
        port=settings.AGENT_PORT,
        reload=True
    )
