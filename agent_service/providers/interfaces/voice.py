from abc import ABC, abstractmethod

class VoiceProvider(ABC):
    @abstractmethod
    async def speech_to_text(self, audio_bytes: bytes) -> str:
        """Transcribes incoming audio binary data into standard text."""
        pass

    @abstractmethod
    async def text_to_speech(self, text: str) -> bytes:
        """Synthesizes text into audio WAV/MP3 bytes."""
        pass
