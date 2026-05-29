import httpx
from agent_service.providers.interfaces.voice import VoiceProvider
from agent_service.config import settings

class DeepgramVoiceProvider(VoiceProvider):
    def __init__(self):
        self.api_key = settings.DEEPGRAM_API_KEY if "dummy" not in settings.DEEPGRAM_API_KEY else None

    async def speech_to_text(self, audio_bytes: bytes) -> str:
        if not self.api_key:
            return ""
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Token {self.api_key}",
                    "Content-Type": "audio/webm"
                }
                response = await client.post(
                    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true",
                    headers=headers,
                    content=audio_bytes,
                    timeout=15.0
                )
                if response.status_code == 200:
                    result = response.json()
                    return result["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
                else:
                    print(f"Deepgram STT returned status code {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Deepgram STT failed: {e}")
        return ""

    async def text_to_speech(self, text: str) -> bytes:
        # Deepgram is primarily STT, return empty wav (to be played silently or fallback used)
        return b""
