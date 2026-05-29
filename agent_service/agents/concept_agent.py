"""
ConceptAgent — LLM-powered academic concept extraction from transcripts.

Identifies important concepts, definitions, importance, and relationships.
Falls back to keyword extraction when LLM is unavailable.
"""

from typing import Dict, Any, Optional, List
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

CONCEPT_SYSTEM_PROMPT = """You are the Concept Extraction Agent for NeuroLearn OS.

Your job is to extract, refine, and rank academic concepts from lecture transcripts using a multi-stage process (Keyword Extraction -> Named Entity Recognition -> LLM Refinement -> Concept Ranking).

You MUST respond ONLY with a raw JSON object (no markdown code fence blocks, no explanatory text) having exactly these two keys:
1. "concepts": An array of objects, where each object represents a ranked concept and has:
   - "concept": Name of the concept
   - "definition": A detailed academic definition of this concept
   - "importance": "High", "Medium", or "Low"
   - "related_concepts": A list of string names of closely related concepts
2. "relationships": An array of relationship links between concepts:
   - "from": Name of source concept
   - "to": Name of target concept
   - "type": "depends_on" or "related_to"

Guidelines:
- Perform named entity extraction to find key academic terms and models.
- Refine descriptions to ensure high clarity.
- Rank concepts in descending order of importance/centrality to the lecture.
- Write everything in the SAME language as the source transcript.
"""


class ConceptAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Concept Extraction Agent",
            system_prompt=CONCEPT_SYSTEM_PROMPT,
            llm=llm
        )

    def extract_concepts(self, transcript: str, max_chars: int = 6000) -> Dict[str, Any]:
        """Extract structured concept data from a transcript."""
        if not transcript or len(transcript.strip()) < 10:
            return {"concepts": [], "relationships": []}

        prompt = f"Extract and rank all academic concepts from this transcript:\n\n{transcript[:max_chars]}"
        result = self.execute_json(prompt)

        if "error" in result:
            return self._fallback_extract(transcript)

        return {
            "concepts": result.get("concepts", []),
            "relationships": result.get("relationships", []),
        }

    def extract_concept_names(self, transcript: str) -> List[str]:
        """Extract just concept names (convenience method)."""
        data = self.extract_concepts(transcript)
        concept_list = data.get("concepts", [])
        names = []
        for item in concept_list:
            if isinstance(item, dict) and "concept" in item:
                names.append(item["concept"])
            elif isinstance(item, str):
                names.append(item)
        return names

    def _fallback_extract(self, transcript: str) -> Dict[str, Any]:
        """Keyword-based concept extraction when LLM is unavailable."""
        try:
            from concept_keywords import extract_concepts_from_text
            concepts = extract_concepts_from_text(transcript, max_concepts=10)
        except ImportError:
            concepts = []

        formatted_concepts = []
        relationships = []
        for i, c in enumerate(concepts):
            formatted_concepts.append({
                "concept": c,
                "definition": f"Key concept extracted from the lecture text on {c}.",
                "importance": "High" if i < 3 else "Medium",
                "related_concepts": [concepts[j] for j in range(len(concepts)) if j != i][:3]
            })
            if i > 0:
                relationships.append({
                    "from": concepts[i-1],
                    "to": c,
                    "type": "related_to"
                })

        return {
            "concepts": formatted_concepts,
            "relationships": relationships,
        }
