"""
FlashcardAgent — Generates spaced-repetition flashcards from lecture transcripts.

Returns a list of JSON objects:
{
    "id": "fc_...",
    "front": "Question...",
    "back": "Answer...",
    "topic": "Topic...",
    "difficulty": "beginner/intermediate/advanced",
    "lecture_id": "lec_..."
}
"""

import uuid
import json
from typing import List, Dict, Any, Optional
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

FLASHCARD_SYSTEM_PROMPT = """You are the Flashcard Generation Agent for NeuroLearn OS.

Your job is to generate high-quality, spaced-repetition-ready flashcards based on the provided lecture materials.

You MUST generate cards across the following 10 distinct types:
1. **Definition Cards**:
   - Front: "What is [concept]?"
   - Back: Accurate, clear definition of the concept.
2. **Concept Cards**:
   - Front: "Why do we use [concept]?" or "What is the purpose of [concept]?"
   - Back: Explanation of the concept's purpose, design, or benefits.
3. **Application Cards**:
   - Front: "When or where would you apply [concept]?"
   - Back: Explanations of practical use cases, constraints, or scenarios.
4. **Scenario Cards**:
   - Front: Present a real-world coding/design problem or scenario.
   - Back: Detail how a concept solves it or is used to analyze it.
5. **Comparison Cards**:
   - Front: "[Concept A] vs [Concept B]"
   - Back: A clear comparison or contrast highlighting key differences.
6. **Cause-and-Effect Cards**:
   - Front: "What happens if [condition/error occurs in concept]?"
   - Back: The direct consequence or error handling behavior.
7. **Exam Preparation Cards**:
   - Front: Ask a typical exam question style (e.g. "Explain how X achieves Y").
   - Back: The complete detailed model answer.
8. **Formula Cards**:
   - Front: "What is the formula/mathematical expression for [concept]?" or "How do you calculate [concept]?"
   - Back: The formula and a brief definition of its variables.
9. **Relationship Cards**:
   - Front: "How does [Concept A] relate to [Concept B]?" or "What is the dependency between [Concept A] and [Concept B]?"
   - Back: Explanation of the relationship or dependency direction.
10. **Recall Cards**:
    - Front: A fill-in-the-blank style prompt, e.g., "[Concept] achieves X by doing ____."
    - Back: The missing word or short phrase.

You MUST respond ONLY with a raw JSON array of objects (no markdown code fence blocks, no explanatory text). Each object in the JSON array must have exactly these keys:
- "front": the front text of the card (make it high value, specific, and detailed. Do NOT output simple, generic questions)
- "back": the back text of the card (must be comprehensive, highly educational, and precise)
- "topic": the specific concept/topic name (e.g. "Normalization")
- "difficulty": must be exactly "beginner", "intermediate", or "advanced"

Guidelines:
- Keep fronts clear, engaging, and context-specific.
- Distribute difficulties: ensure a healthy mix of beginner, intermediate, and advanced cards.
- Reject low-value or generic placeholders. If the transcript mentions "Normalization reduces redundancy in databases", a card like Front: "What is normalization?", Back: "Normalization reduces redundancy." is REJECTED. Instead, construct a scenario-based or application-based card.
- Write all cards in the SAME language as the source materials.
"""


class FlashcardAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Flashcard Agent",
            system_prompt=FLASHCARD_SYSTEM_PROMPT,
            llm=llm
        )

    def generate_cards(
        self,
        transcript: str,
        summary: str = "",
        notes: str = "",
        concepts: List[Dict[str, Any]] = None,
        relationships: List[Dict[str, Any]] = None,
        lecture_category: str = "",
        lecture_tags: List[str] = None,
        lecture_id: str = "",
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Generate high-quality flashcards from the transcript and multi-stage pipeline context."""
        if not transcript or len(transcript.strip()) < 15:
            return []

        # Determine target count based on transcript word count
        word_count = len(transcript.split())
        if word_count < 500:
            req_count = 15
        elif word_count < 2000:
            req_count = 25
        else:
            req_count = 45

        # Format input materials to maximize available context
        prompt = (
            f"Generate a minimum of {req_count} flashcards (and up to 60 if needed) covering a rich mix "
            f"of the 10 specified card types. Organize the difficulty levels (beginner, intermediate, advanced) "
            f"intelligently. Use the following context inputs:\n\n"
            f"Lecture Category: {lecture_category or 'General'}\n"
            f"Lecture Tags: {', '.join(lecture_tags or [])}\n\n"
            f"Extracted Concepts:\n{json.dumps(concepts or [], indent=2)}\n\n"
            f"Concept Relationships (Knowledge Graph):\n{json.dumps(relationships or [], indent=2)}\n\n"
            f"Lecture Summary:\n{summary}\n\n"
            f"Revision Notes:\n{notes}\n\n"
            f"Full Transcript:\n{transcript}\n"
        )
        
        result = self.execute_json(prompt, context)

        if isinstance(result, dict) and "error" in result:
            print(f"[FlashcardAgent] Error during generation: {result.get('error')}")
            return []

        cards = []
        raw_list = []
        if isinstance(result, list):
            raw_list = result
        elif isinstance(result, dict):
            if "flashcards" in result:
                raw_list = result["flashcards"]
            elif "cards" in result:
                raw_list = result["cards"]
            elif "front" in result:
                raw_list = [result]
        
        for item in raw_list:
            if not isinstance(item, dict):
                continue
            cards.append({
                "id": f"fc_{uuid.uuid4().hex[:8]}",
                "front": item.get("front", "").strip(),
                "back": item.get("back", "").strip(),
                "topic": item.get("topic", "General").strip(),
                "difficulty": item.get("difficulty", "intermediate").strip(),
                "lecture_id": lecture_id
            })

        return cards
