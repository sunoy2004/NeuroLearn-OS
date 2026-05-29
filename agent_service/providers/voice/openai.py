from io import BytesIO
from openai import OpenAI
from agent_service.providers.interfaces.voice import VoiceProvider
from agent_service.config import settings

class OpenAIVoiceProvider(VoiceProvider):
    def __init__(self):
        api_key = settings.OPENAI_API_KEY if "dummy" not in settings.OPENAI_API_KEY else None
        self.client = OpenAI(api_key=api_key) if api_key else None

    async def speech_to_text(self, audio_bytes: bytes) -> str:
        if not self.client:
            return ""
        try:
            audio_file = BytesIO(audio_bytes)
            audio_file.name = "audio.webm"
            transcript = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
            )
            return transcript.text.strip()
        except Exception as e:
            print(f"OpenAI Whisper transcription failed: {e}")
        return ""

    async def text_to_speech(self, text: str) -> bytes:
        if not self.client:
            return b""
        try:
            response = self.client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=text
            )
            return response.content
        except Exception as e:
            print(f"OpenAI TTS synthesis failed: {e}")
        return b""
