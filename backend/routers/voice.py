import base64
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db, DBUserProfile
from backend.models import VoiceCommandRequest, VoiceCommandResponse
from backend.services import lyzr_service, speech_service, qdrant_service

router = APIRouter(prefix="/api/voice", tags=["voice"])

@router.post("/process")
async def process_voice_command(req: VoiceCommandRequest, db: Session = Depends(get_db)):
    """REST endpoint to process voice transcripts via Master Orchestrator."""
    try:
        # 1. Route via Lyzr Orchestration
        result = lyzr_service.master_orchestrator.route_command(req.transcript, req.userId)
        
        # 2. Synthesize TTS
        audio_bytes = await speech_service.text_to_speech(result["response"])
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        audio_url = f"data:audio/wav;base64,{audio_base64}"
        
        # 3. Dynamic Profile Update in Database (if analytics triggered)
        if result["agentExecuted"] == "analytics":
            profile = db.query(DBUserProfile).filter(DBUserProfile.id == req.userId).first()
            if profile:
                profile.concepts_mastered = min(profile.concepts_mastered + 1, 50)
                db.commit()
        
        return {
            "id": f"resp-{int(time.time()*1000)}",
            "transcript": req.transcript,
            "intent": result["intent"],
            "confidence": result["confidence"],
            "entities": result["entities"],
            "response": result["response"],
            "audioUrl": audio_url,
            "agentExecuted": result["agentExecuted"],
            "timestamp": time.time()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws/voice-stream")
async def websocket_voice_endpoint(websocket: WebSocket):
    """WebSocket endpoint to capture microphone audio streaming chunks."""
    await websocket.accept()
    audio_buffer = bytearray()
    
    try:
        while True:
            # We can receive either text signals or binary audio frames
            message = await websocket.receive()
            
            if "bytes" in message:
                audio_buffer.extend(message["bytes"])
                
            elif "text" in message:
                text_data = message["text"]
                
                # Check for control commands
                if text_data == "clear":
                    audio_buffer.clear()
                    
                elif text_data == "process_recording":
                    if len(audio_buffer) == 0:
                        await websocket.send_json({
                            "event": "error",
                            "message": "No audio data received"
                        })
                        continue
                        
                    # 1. Transcribe gathered audio
                    transcript = await speech_service.transcribe_audio(bytes(audio_buffer))
                    audio_buffer.clear()
                    
                    # 2. Run orchestrator
                    result = lyzr_service.master_orchestrator.route_command(transcript, "demo-user")
                    
                    # 3. Generate TTS
                    audio_bytes = await speech_service.text_to_speech(result["response"])
                    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                    audio_url = f"data:audio/wav;base64,{audio_base64}"
                    
                    # 4. Stream back response
                    await websocket.send_json({
                        "event": "result",
                        "transcript": transcript,
                        "intent": result["intent"],
                        "response": result["response"],
                        "audioUrl": audio_url,
                        "agentExecuted": result["agentExecuted"]
                    })
                    
    except WebSocketDisconnect:
        print("Voice streaming WebSocket disconnected.")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass
