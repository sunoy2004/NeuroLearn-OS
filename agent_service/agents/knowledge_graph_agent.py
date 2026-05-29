"""
KnowledgeGraphAgent — Builds and updates concept graphs from lecture transcripts.
"""

from typing import Dict, Any, List, Optional
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider


GRAPH_SYSTEM_PROMPT = """You are the Knowledge Graph Agent for NeuroLearn OS.

Analyze lecture transcript content and identify:
1. Academic concepts (nodes)
2. Relationships between concepts (edges)

Respond ONLY with raw JSON:
{
  "concepts": ["concept1", "concept2"],
  "relationships": [{"from": "concept1", "to": "concept2", "type": "prerequisite|related|extends"}]
}

Be conservative — only include genuinely academic concepts being taught.
"""


class KnowledgeGraphAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Knowledge Graph Agent",
            system_prompt=GRAPH_SYSTEM_PROMPT,
            llm=llm,
        )

    def extract_graph(self, transcript: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not transcript or len(transcript.strip()) < 15:
            return {"concepts": [], "relationships": []}

        prompt = f"Extract concept graph from this lecture transcript:\n\n{transcript[:4000]}"
        result = self.execute_json(prompt, context)

        if "error" in result:
            return {"concepts": [], "relationships": []}

        return {
            "concepts": result.get("concepts", []),
            "relationships": result.get("relationships", []),
        }

    def update_from_chunk(self, chunk: str) -> List[str]:
        """Quick concept extraction from a live transcript chunk."""
        result = self.extract_graph(chunk)
        return [c for c in result.get("concepts", []) if isinstance(c, str)]
