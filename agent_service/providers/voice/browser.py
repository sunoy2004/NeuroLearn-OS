from agent_service.providers.interfaces.voice import VoiceProvider

class BrowserVoiceProvider(VoiceProvider):
    async def speech_to_text(self, audio_bytes: bytes) -> str:
        # Browser handles transcription client-side
        return ""

    async def text_to_speech(self, text: str) -> bytes:
        # Browser handles synthesis client-side
        return b""
