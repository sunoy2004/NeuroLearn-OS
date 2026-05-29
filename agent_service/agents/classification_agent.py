"""
ClassificationAgent — Analyzes transcript to classify lectures with meaningful titles.

Generates: {title, category, tags} from transcript content.
Falls back to concept-keyword based classification when LLM is unavailable.
"""

from typing import Dict, Any, Optional, List
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

CLASSIFICATION_SYSTEM_PROMPT = """You are the Lecture Classification Agent for NeuroLearn OS.

Your job is to analyze lecture transcripts and generate a meaningful title, category, and tags.

Respond ONLY with a raw JSON object (no markdown):
{
  "title": "A descriptive, concise lecture title (e.g., 'Introduction to Neural Networks' or 'Database Normalization Concepts')",
  "category": "The academic category (e.g., 'Machine Learning', 'Database Systems', 'Operating Systems', 'Data Structures', 'Algorithms', 'Computer Networks')",
  "tags": ["Tag1", "Tag2", "Tag3"]
}

Guidelines:
- Title should be 3-8 words, descriptive, and academic
- Never use generic titles like "Lecture 1" or "Lecture - date"
- Category should be a recognized CS/academic field
- Tags should be 3-5 specific concepts mentioned in the transcript
- Detect the language of the transcript and respond in that language for the title
"""


class ClassificationAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Lecture Classification Agent",
            system_prompt=CLASSIFICATION_SYSTEM_PROMPT,
            llm=llm,
        )

    def classify_lecture(self, transcript: str, max_chars: int = 4000) -> Dict[str, Any]:
        """Classify a lecture transcript and return title, category, and tags."""
        if not transcript or len(transcript.strip()) < 10:
            return {"title": "Short Lecture", "category": "General", "tags": []}

        prompt = f"Classify this lecture transcript:\n\n{transcript[:max_chars]}"
        result = self.execute_json(prompt)

        if "error" in result:
            # Fallback to keyword-based classification
            return self._fallback_classify(transcript)

        return {
            "title": result.get("title", "Lecture"),
            "category": result.get("category", "General"),
            "tags": result.get("tags", []),
        }

    def _fallback_classify(self, transcript: str) -> Dict[str, Any]:
        """Keyword-based classification when LLM is unavailable."""
        try:
            from concept_keywords import extract_concepts_from_text
            concepts = extract_concepts_from_text(transcript, max_concepts=6)
        except ImportError:
            concepts = []

        if not concepts:
            return {"title": "Study Session", "category": "General", "tags": []}

        # Build title from concepts
        if len(concepts) == 1:
            title = f"Introduction to {concepts[0]}"
        elif len(concepts) == 2:
            title = f"{concepts[0]} and {concepts[1]}"
        else:
            title = f"{concepts[0]}, {concepts[1]} & Related Concepts"

        # Determine category from concept keywords
        category = "Computer Science"
        lower_concepts = " ".join(c.lower() for c in concepts)
        if any(kw in lower_concepts for kw in ["normalization", "sql", "bcnf", "acid", "database", "transaction"]):
            category = "Database Systems"
        elif any(kw in lower_concepts for kw in ["deadlock", "paging", "scheduling", "semaphore", "process", "thread", "virtual memory"]):
            category = "Operating Systems"
        elif any(kw in lower_concepts for kw in ["tree", "graph", "stack", "queue", "linked list", "hash", "heap", "array"]):
            category = "Data Structures"
        elif any(kw in lower_concepts for kw in ["sorting", "dynamic programming", "recursion", "binary search", "divide", "greedy", "backtracking"]):
            category = "Algorithms"
        elif any(kw in lower_concepts for kw in ["neural", "machine learning", "perceptron", "gradient"]):
            category = "Machine Learning"

        return {
            "title": title,
            "category": category,
            "tags": concepts[:5],
        }
