import httpx
from agent_service.providers.interfaces.voice import VoiceProvider
from agent_service.config import settings

class ElevenLabsVoiceProvider(VoiceProvider):
    def __init__(self):
        self.api_key = settings.ELEVEN_LABS_API_KEY if "dummy" not in settings.ELEVEN_LABS_API_KEY else None

    async def speech_to_text(self, audio_bytes: bytes) -> str:
        return ""

    async def text_to_speech(self, text: str) -> bytes:
        if not self.api_key:
            return b""
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "xi-api-key": self.api_key,
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
            print(f"ElevenLabs TTS failed: {e}")
        return b""
