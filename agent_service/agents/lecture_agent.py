"""
LectureAgent — Handles lecture state coordination and concept extraction.

Replaces hardcoded keyword matching with LLM-powered concept detection.
"""

from typing import Dict, Any, Optional, List
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

LECTURE_SYSTEM_PROMPT = """You are the Lecture Ingestion Agent for NeuroLearn OS.

Your role is to analyze lecture transcript chunks and extract academic concepts in real-time.

When given a transcript chunk, respond ONLY with a raw JSON object:
- "concepts": an array of concept names detected in the chunk (empty array if none found)
- "is_significant": boolean indicating if this chunk contains meaningful academic content

Guidelines:
- Detect academic concepts including: data structures (stack, queue, linked list, graph, tree),
  algorithms (sorting, dynamic programming, recursion, BFS, DFS), complexity (time/space, Big-O),
  DBMS (BCNF, normalization, ACID, SQL), OS (deadlock, paging, scheduling, semaphores), etc.
- Only flag concepts that are being explained or discussed, not just mentioned in passing
- Be liberal with clearly technical terms the speaker is teaching about
- Return an empty concepts array for greetings, filler words, or non-academic speech
- Detect concepts in ANY language — use the language of the transcript for concept names
"""

CONCEPT_DETECTION_PROMPT = """You are a real-time concept detector for a live lecture transcript.

Analyze the following transcript chunk and identify any academic concepts being discussed.

Respond ONLY with a raw JSON object:
{"concepts": ["concept1", "concept2"], "is_significant": true/false}

If no academic concepts are found, respond: {"concepts": [], "is_significant": false}

Transcript chunk: "{chunk}"
"""


class LectureAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Lecture Ingestion Agent",
            system_prompt=LECTURE_SYSTEM_PROMPT,
            llm=llm
        )

    def detect_concepts(self, chunk: str) -> List[str]:
        """Analyze a transcript chunk and return detected concept names."""
        if not chunk or len(chunk.strip()) < 5:
            return []

        prompt = CONCEPT_DETECTION_PROMPT.format(chunk=chunk)
        result = self.execute_json(prompt)

        concepts: List[str] = []
        if "error" not in result:
            raw = result.get("concepts", [])
            concepts = [c for c in raw if isinstance(c, str) and len(c) > 1]

        try:
            from concept_keywords import extract_concepts_from_text
            for kw in extract_concepts_from_text(chunk, max_concepts=5):
                if kw not in concepts:
                    concepts.append(kw)
        except ImportError:
            pass

        return concepts

    def coordinate_start(self, subject: str) -> str:
        """Generate a response for starting a lecture recording."""
        return f"Initializing lecture recording for {subject}. The microphone stream is now active. I'll be detecting key concepts as you speak."

    def coordinate_stop(self) -> str:
        """Generate a response for stopping a lecture recording."""
        return "Stopping lecture recording. Compiling the transcript and initializing the post-lecture summarization pipeline."
