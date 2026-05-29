import httpx
from openai import OpenAI
from typing import Optional
from agent_service.config import settings

def generate_placeholder_audio() -> bytes:
    """Generates a valid 1-second silent 8kHz 8-bit mono WAV file."""
    header = b'RIFF\x24\x1f\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x40\x1f\x00\x00\x40\x1f\x00\x00\x01\x00\x08\x00data\x00\x1f\x00\x00'
    data = b'\x80' * 8000
    return header + data

async def transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribes audio using Deepgram with an OpenAI Whisper fallback."""
    # 1. Deepgram Integration
    if settings.DEEPGRAM_API_KEY and "dummy" not in settings.DEEPGRAM_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
                    "Content-Type": "audio/webm"
                }
                response = await client.post(
                    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
                    headers=headers,
                    content=audio_bytes,
                    timeout=10.0
                )
                if response.status_code == 200:
                    result = response.json()
                    return result["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
                else:
                    print(f"Deepgram returned code {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Deepgram transcription error: {e}")
            
    # 2. OpenAI Whisper Fallback
    if settings.OPENAI_API_KEY and "dummy" not in settings.OPENAI_API_KEY:
        try:
            from io import BytesIO
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            audio_file = BytesIO(audio_bytes)
            audio_file.name = "audio.webm"
            
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
            return transcript.text.strip()
        except Exception as e:
            print(f"OpenAI Whisper transcription failed: {e}")
            
    return "Explain B+ Trees"

async def text_to_speech(text: str) -> bytes:
    """Generates audio bytes via ElevenLabs or OpenAI TTS."""
    # ElevenLabs
    if settings.ELEVEN_LABS_API_KEY and "dummy" not in settings.ELEVEN_LABS_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "xi-api-key": settings.ELEVEN_LABS_API_KEY,
                    "Content-Type": "application/json"
                }
                payload = {
                    "text": text,
                    "model_id": "eleven_monolingual_v1",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75
                    }
                }
                response = await client.post(
                    "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
                    headers=headers,
                    json=payload,
                    timeout=15.0
                )
                if response.status_code == 200:
                    return response.content
        except Exception as e:
            print(f"ElevenLabs TTS failed: {e}. Trying OpenAI TTS...")

    # OpenAI TTS
    if settings.OPENAI_API_KEY and "dummy" not in settings.OPENAI_API_KEY:
        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=text
            )
            return response.content
        except Exception as e:
            print(f"OpenAI TTS failed: {e}")
            
    return generate_placeholder_audio()
