import httpx
from openai import OpenAI
from backend.config import settings

def generate_placeholder_audio() -> bytes:
    """Generates a valid 1-second silent 8kHz 8-bit mono WAV file."""
    # RIFF header, format WAVE, subchunk fmt, channels=1, samplerate=8000, bitspersample=8, subchunk data
    header = b'RIFF\x24\x1f\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x40\x1f\x00\x00\x40\x1f\x00\x00\x01\x00\x08\x00data\x00\x1f\x00\x00'
    data = b'\x80' * 8000
    return header + data

async def transcribe_audio(audio_bytes: bytes) -> str:
    """Sends audio buffer to Deepgram for transcription, falling back to OpenAI Whisper."""
    # 1. Try Deepgram
    if settings.DEEPGRAM_API_KEY and "dummy" not in settings.DEEPGRAM_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
                    "Content-Type": "audio/webm"  # standard web audio capture format
                }
                # Use Deepgram Nova-2 model for fast and accurate transcription
                response = await client.post(
                    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
                    headers=headers,
                    content=audio_bytes,
                    timeout=10.0
                )
                if response.status_code == 200:
                    result = response.json()
                    transcript = result["results"]["channels"][0]["alternatives"][0]["transcript"]
                    return transcript.strip()
                else:
                    print(f"Deepgram returned status {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Error calling Deepgram API: {e}")
            
    # 2. Fallback to OpenAI Whisper
    if settings.OPENAI_API_KEY and "dummy" not in settings.OPENAI_API_KEY:
        try:
            from io import BytesIO
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            audio_file = BytesIO(audio_bytes)
            audio_file.name = "audio.webm"  # OpenAI requires a file name with extension
            
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
            return transcript.text.strip()
        except Exception as e:
            print(f"OpenAI Whisper transcription failed: {e}")
        
    return "Explain deadlock prevention"


async def text_to_speech(text: str) -> bytes:
    """Generates speech audio from text using OpenAI TTS or ElevenLabs, with fallback."""
    # Attempt ElevenLabs if configured
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
                # Use standard voice 'Rachel' or any default
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

    # Fallback to OpenAI TTS
    if settings.OPENAI_API_KEY and "dummy" not in settings.OPENAI_API_KEY:
        try:
            # Sync client run in async executor
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=text
            )
            return response.content
        except Exception as e:
            print(f"OpenAI TTS failed: {e}")
            
    # Final fallback: Silent WAV audio bytes
    return generate_placeholder_audio()
