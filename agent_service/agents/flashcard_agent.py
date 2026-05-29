"""
FlashcardAgent — Generates spaced-repetition flashcards from lecture transcripts.

Returns a list of JSON objects:
{
    "id": "fc_...",
    "front": "Question...",
    "back": "Answer...",
    "topic": "Topic...",
    "difficulty": "Easy/Medium/Hard",
    "lecture_id": "lec_..."
}
"""

import uuid
from typing import List, Dict, Any, Optional
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

FLASHCARD_SYSTEM_PROMPT = """You are the Flashcard Generation Agent for NeuroLearn OS.

Your job is to generate high-quality, spaced-repetition-ready flashcards based on a lecture transcript.

For each lecture, you MUST generate a MINIMUM of 20 flashcards (and up to 50 flashcards if the transcript is long or covers multiple concepts).

You MUST generate cards across the following 4 distinct types:
1. **Definition Cards**:
   - Front: "What is [concept]?"
   - Back: Accurate, clear definition of the concept.
2. **Concept Cards**:
   - Front: "Why do we use [concept]?" or "What is the purpose of [concept]?"
   - Back: Explanation of the concept's purpose, design, or benefits.
3. **Application Cards**:
   - Front: "When or where would you apply [concept]?"
   - Back: Explanations of practical use cases, constraints, or scenarios.
4. **Comparison Cards**:
   - Front: "[Concept A] vs [Concept B]"
   - Back: A clear comparison or contrast highlighting key differences.

You MUST respond ONLY with a raw JSON array of objects (no markdown code fence blocks, no explanatory text). Each object in the JSON array must have exactly these keys:
- "front": the front text of the card
- "back": the back text of the card
- "topic": the specific concept name (e.g. "Normalization", "B-Tree")
- "difficulty": "Easy", "Medium", or "Hard"

Guidelines:
- Keep fronts clear and direct.
- Keep backs concise but highly educational and informative.
- Ensure cards cover a broad range of concepts mentioned in the text.
- Write all cards in the SAME language as the source transcript.
"""


class FlashcardAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Flashcard Agent",
            system_prompt=FLASHCARD_SYSTEM_PROMPT,
            llm=llm
        )

    def generate_cards(self, transcript: str, lecture_id: str = "") -> List[Dict[str, Any]]:
        """Generate a minimum of 20 flashcards from the transcript."""
        if not transcript or len(transcript.strip()) < 15:
            return []

        # Request at least 20-50 flashcards in prompt
        prompt = (
            f"Generate a minimum of 20 to 50 flashcards (covering all 4 card types) "
            f"based on this lecture transcript:\n\n{transcript}"
        )
        result = self.execute_json(prompt)

        if isinstance(result, dict) and "error" in result:
            print(f"[FlashcardAgent] Error during generation: {result.get('error')}")
            return []

        cards = []
        raw_list = result if isinstance(result, list) else []
        
        for item in raw_list:
            if not isinstance(item, dict):
                continue
            cards.append({
                "id": f"fc_{uuid.uuid4().hex[:8]}",
                "front": item.get("front", "").strip(),
                "back": item.get("back", "").strip(),
                "topic": item.get("topic", "General").strip(),
                "difficulty": item.get("difficulty", "Medium").strip(),
                "lecture_id": lecture_id
            })

        return cards
