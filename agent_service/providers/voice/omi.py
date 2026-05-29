"""Omi-compatible voice STT — Deepgram cloud transcription (same engine as Omi platform)."""

import httpx
from agent_service.config import settings
from agent_service.providers.interfaces.voice import VoiceProvider


def _detect_audio_content_type(audio_bytes: bytes) -> str:
    if len(audio_bytes) >= 4 and audio_bytes[:4] == b"OggS":
        return "audio/ogg"
    if len(audio_bytes) >= 4 and audio_bytes[:4] == b"RIFF":
        return "audio/wav"
    return "audio/webm"


class OmiVoiceProvider(VoiceProvider):
    """
    Omi Voice provider for NeuroLearn OS.
    Uses Deepgram Nova (Omi's cloud STT backend) for lecture capture and voice commands.
    """

    def __init__(self):
        self.api_key = None
        for key in (
            getattr(settings, "OMI_DEEPGRAM_API_KEY", "") or "",
            settings.DEEPGRAM_API_KEY or "",
        ):
            if key and "dummy" not in key.lower():
                self.api_key = key
                break

    async def speech_to_text(self, audio_bytes: bytes) -> str:
        if not self.api_key:
            print("[OmiVoiceProvider] No OMI_DEEPGRAM_API_KEY / DEEPGRAM_API_KEY — set in .env")
            return ""
        if not audio_bytes or len(audio_bytes) < 100:
            print("[OmiVoiceProvider] Audio buffer too small for transcription")
            return ""

        content_type = _detect_audio_content_type(audio_bytes)
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Token {self.api_key}",
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
                    transcript = (
                        result.get("results", {})
                        .get("channels", [{}])[0]
                        .get("alternatives", [{}])[0]
                        .get("transcript", "")
                        .strip()
                    )
                    return transcript
                print(
                    f"[OmiVoiceProvider] STT error {response.status_code}: "
                    f"{response.text[:300]}"
                )
        except Exception as e:
            print(f"[OmiVoiceProvider] STT failed: {e}")
        return ""

    async def text_to_speech(self, text: str) -> bytes:
        return b""
