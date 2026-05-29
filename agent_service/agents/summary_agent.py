"""
SummaryAgent — Post-lecture summarization: title, summary paragraph, key concepts.

Used by the lecture compilation pipeline after recording stops.
"""

from typing import Dict, Any, Optional
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

SUMMARY_SYSTEM_PROMPT = """You are the Lecture Summarization Agent for NeuroLearn OS.

Your role is to create structured summaries from raw transcribed lecture audio.

Respond ONLY with a raw JSON object (no markdown, no explanation). The JSON must have exactly these keys:
- "title": a concise, descriptive title for the lecture (max 10 words)
- "summary": a clear paragraph summarizing the key content and takeaways
- "concepts": an array of strings representing the main academic concepts covered

Guidelines:
- The title should capture the primary topic discussed
- The summary should be 2-4 sentences covering the main ideas
- Concepts should be specific academic terms, not generic words
- Extract 3-8 concepts depending on the lecture length
- Title, summary, and concept names must be in the same language as the transcript
"""


class SummaryAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Lecture Summarization Agent",
            system_prompt=SUMMARY_SYSTEM_PROMPT,
            llm=llm
        )

    def summarize(self, transcript: str) -> Dict[str, Any]:
        """Summarize a complete lecture transcript into structured data."""
        if not transcript or len(transcript.strip()) < 20:
            return {
                "title": "Untitled Lecture",
                "summary": "Lecture transcript was too short to summarize.",
                "concepts": []
            }

        result = self.execute_json(
            f"Summarize the following lecture transcript:\n\n{transcript}"
        )

        if "error" in result:
            return {
                "title": "Lecture Summary",
                "summary": "Failed to generate a structured summary.",
                "concepts": []
            }

        return {
            "title": result.get("title", "Lecture Summary"),
            "summary": result.get("summary", "Summary unavailable."),
            "concepts": result.get("concepts", [])
        }
