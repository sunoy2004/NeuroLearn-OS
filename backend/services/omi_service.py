"""
Omi Voice integration — cloud STT pipeline compatible with Omi's Deepgram-based transcription.

For web apps: streams browser mic audio → Deepgram (same engine Omi uses at api.omi.me).
Optional: proxy to wss://api.omi.me/v4/listen when OMI_UID is configured.
"""

import os
from typing import Optional

import httpx

from backend.config import settings


def get_omi_stt_api_key() -> Optional[str]:
    """Omi cloud STT uses Deepgram — accept OMI or DEEPGRAM key."""
    for key in (
        os.environ.get("OMI_DEEPGRAM_API_KEY", ""),
        os.environ.get("DEEPGRAM_API_KEY", ""),
        settings.DEEPGRAM_API_KEY if hasattr(settings, "DEEPGRAM_API_KEY") else "",
    ):
        if key and key.strip() and "dummy" not in key.lower():
            return key.strip()
    return None


def is_omi_configured() -> bool:
    return bool(get_omi_stt_api_key()) or bool(os.environ.get("OMI_UID", "").strip())


async def transcribe_audio_omi(audio_bytes: bytes, content_type: str = "audio/webm") -> str:
    """
    Transcribe audio using Deepgram (Omi-compatible cloud STT).
    Omi's platform uses Deepgram Nova at wss://api.omi.me/v4/listen — this REST path matches that engine.
    """
    api_key = get_omi_stt_api_key()
    if not api_key:
        return ""

    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Token {api_key}",
                "Content-Type": content_type,
            }
            response = await client.post(
                "https://api.deepgram.com/v1/listen"
                "?model=nova-2&smart_format=true&detect_language=true&punctuate=true",
                headers=headers,
                content=audio_bytes,
                timeout=30.0,
            )
            if response.status_code == 200:
                result = response.json()
                return (
                    result.get("results", {})
                    .get("channels", [{}])[0]
                    .get("alternatives", [{}])[0]
                    .get("transcript", "")
                    .strip()
                )
            print(f"[OmiVoice] Deepgram STT status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print(f"[OmiVoice] Transcription failed: {e}")
    return ""


def omi_listen_url(uid: str, language: str = "en") -> str:
    """Build Omi real-time listen WebSocket URL (requires Firebase uid)."""
    base = os.environ.get("OMI_LISTEN_URL", "wss://api.omi.me/v4/listen")
    return f"{base}?uid={uid}&language={language}&sample_rate=16000&codec=pcm16&stt_service=deepgram"
