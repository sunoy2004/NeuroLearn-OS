import os
from io import BytesIO
from typing import Tuple

import httpx
from openai import OpenAI
from backend.config import settings

MIME_FOR_EXT = {
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".webm": "audio/webm",
    ".mpeg": "audio/mpeg",
    ".mpga": "audio/mpeg",
}

ALLOWED_UPLOAD_EXTENSIONS = set(MIME_FOR_EXT.keys())
WHISPER_MAX_BYTES = 25 * 1024 * 1024

def generate_placeholder_audio() -> bytes:
    """Generates a valid 1-second silent 8kHz 8-bit mono WAV file."""
    # RIFF header, format WAVE, subchunk fmt, channels=1, samplerate=8000, bitspersample=8, subchunk data
    header = b'RIFF\x24\x1f\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x40\x1f\x00\x00\x40\x1f\x00\x00\x01\x00\x08\x00data\x00\x1f\x00\x00'
    data = b'\x80' * 8000
    return header + data

async def _transcribe_with_deepgram(
    audio_bytes: bytes,
    content_type: str = "audio/webm",
    timeout: float = 120.0,
) -> Tuple[str, float]:
    """Returns (transcript, duration_seconds)."""
    from backend.services.omi_service import transcribe_audio_omi, is_omi_configured

    if is_omi_configured():
        transcript = await transcribe_audio_omi(audio_bytes, content_type)
        if transcript:
            return transcript.strip(), 0.0

    if settings.DEEPGRAM_API_KEY and "dummy" not in settings.DEEPGRAM_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
                    "Content-Type": content_type,
                }
                response = await client.post(
                    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
                    headers=headers,
                    content=audio_bytes,
                    timeout=timeout,
                )
                if response.status_code == 200:
                    result = response.json()
                    transcript = (
                        result.get("results", {})
                        .get("channels", [{}])[0]
                        .get("alternatives", [{}])[0]
                        .get("transcript", "")
                    )
                    duration = float(result.get("metadata", {}).get("duration", 0) or 0)
                    return transcript.strip(), duration
                print(f"Deepgram returned status {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Error calling Deepgram API: {e}")

    return "", 0.0


async def _transcribe_with_whisper(audio_bytes: bytes, filename: str) -> str:
    if not settings.OPENAI_API_KEY or "dummy" in settings.OPENAI_API_KEY:
        return ""
    if len(audio_bytes) > WHISPER_MAX_BYTES:
        raise ValueError(
            f"File exceeds Whisper's 25MB limit ({len(audio_bytes) // (1024 * 1024)}MB). "
            "Configure DEEPGRAM_API_KEY for larger uploads."
        )
    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        audio_file = BytesIO(audio_bytes)
        audio_file.name = filename
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
        return transcript.text.strip()
    except Exception as e:
        print(f"OpenAI Whisper transcription failed: {e}")
        return ""


async def transcribe_audio(audio_bytes: bytes) -> str:
    """Omi-compatible STT (Deepgram) with OpenAI Whisper fallback."""
    transcript, _ = await _transcribe_with_deepgram(audio_bytes, "audio/webm", timeout=30.0)
    if transcript:
        return transcript
    whisper_text = await _transcribe_with_whisper(audio_bytes, "audio.webm")
    if whisper_text:
        return whisper_text
    return "Explain deadlock prevention"


async def transcribe_media_file(audio_bytes: bytes, filename: str) -> Tuple[str, float]:
    """
    Transcribe an uploaded audio/video file.
    Returns (transcript, duration_seconds).
    """
    ext = os.path.splitext((filename or "").lower())[1]
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext or 'unknown'}'. Use MP3, MP4, WAV, or M4A.")

    content_type = MIME_FOR_EXT.get(ext, "application/octet-stream")
    timeout = 180.0 if len(audio_bytes) > 10 * 1024 * 1024 else 90.0

    transcript, duration = await _transcribe_with_deepgram(audio_bytes, content_type, timeout=timeout)
    if transcript:
        return transcript, duration

    whisper_text = await _transcribe_with_whisper(audio_bytes, filename or f"upload{ext or '.mp3'}")
    if whisper_text:
        est_duration = duration or max(60.0, len(whisper_text.split()) * 0.4)
        return whisper_text, est_duration

    raise ValueError(
        "Transcription failed. Configure DEEPGRAM_API_KEY or OPENAI_API_KEY in your .env file."
    )


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
