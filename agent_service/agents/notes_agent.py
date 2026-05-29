"""
NotesAgent — Generates structured, detailed academic study and revision notes in Markdown.
"""

from typing import Dict, Any, Optional
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

NOTES_SYSTEM_PROMPT = """You are the Notes Generation Agent for NeuroLearn OS.

Your job is to generate comprehensive, highly detailed, and beautifully structured academic study and revision notes based on a lecture transcript (or merged section summaries).

You MUST structure the generated notes exactly using the following Markdown sections:

# [Lecture Topic Title]

## Overview
[Provide a clear, detailed overview of the lecture topic and main themes]

## Key Concepts
[Detailed list of main academic concepts covered in this lecture with bullet points]

## Definitions
[Clear definitions for each key technical term and acronym mentioned]

## Important Points
[Bullet points highlighting crucial takeaways, rules, and core insights]

## Examples
[Detailed concrete examples and analogies used in the lecture to explain these concepts]

## Common Mistakes
[List potential pitfalls, student misconceptions, or errors to avoid regarding these concepts]

## Exam Tips
[Key points likely to be tested in exams, typical question angles, and scoring hints]

## Revision Summary
[A concise final summary of what was covered to aid quick review]

Guidelines:
- Ensure the notes are detailed, structured, and ready for intensive study.
- Do not abbreviate or shorten the definitions — make them thorough.
- Write the notes in the SAME language as the source transcript.
- Respond ONLY with the Markdown content (no conversational prefix, suffix, or markdown code fence wrappers).
"""


class NotesAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Notes Agent",
            system_prompt=NOTES_SYSTEM_PROMPT,
            llm=llm
        )

    def generate_notes(self, transcript: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Generate study notes from the transcript."""
        if not transcript or len(transcript.strip()) < 15:
            return "Transcript too short to generate study notes."
        
        prompt = f"Generate detailed study and revision notes based on this lecture transcript/summaries:\n\n{transcript}"
        return self.execute(prompt, context)
