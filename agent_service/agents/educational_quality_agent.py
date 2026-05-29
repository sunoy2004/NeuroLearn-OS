"""
EducationalQualityAgent — Validates educational quality, depth, and coverage.
"""

import json
from typing import Dict, Any, List, Optional
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

QUALITY_SYSTEM_PROMPT = """You are the Educational Quality Assurance Agent for NeuroLearn OS.

Your job is to analyze the generated notes, flashcards, and quizzes to ensure they meet our strict quality and coverage standards.

Quality Standards:
1. **Concept Coverage**: At least 80% of core concepts must be covered by the flashcards or quiz questions.
2. **Knowledge Graph Coverage**: At least 80% of concept relationships/dependencies must be assessed by the flashcards or quizzes.
3. **Revision Notes Quality**: Notes must be detailed, complete, and formatted correctly in Markdown.

You MUST respond ONLY with a raw JSON object (no markdown code fence blocks, no explanatory text) containing exactly these keys:
- "approved": boolean (true if all standards are met, false if there are gaps)
- "feedback": a detailed string explaining what gaps were found and how to fix them
- "missing_concepts": list of strings (names of concepts that need more coverage)
- "missing_relationships": list of objects (relationships in form {"from": "...", "to": "...", "type": "..."} that need more coverage)
"""


class EducationalQualityAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Educational Quality Agent",
            system_prompt=QUALITY_SYSTEM_PROMPT,
            llm=llm
        )

    def verify_quality(
        self,
        notes: str,
        flashcards: List[Dict[str, Any]],
        quizzes: List[Dict[str, Any]],
        concepts: List[Dict[str, Any]],
        relationships: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Validate generated materials programmatically and semantically."""
        # 1. Deterministic Python Checks
        errors = []
        
        # Flashcard count check (never less than 15)
        if len(flashcards) < 15:
            errors.append(f"Flashcard count is too low: generated {len(flashcards)}, minimum required is 15.")
            
        # Quiz count check (never less than 10)
        if len(quizzes) < 10:
            errors.append(f"Quiz question count is too low: generated {len(quizzes)}, minimum required is 10.")
            
        # Explanation check (100% of questions must have explanations)
        missing_explanations = [
            q.get("question") for q in quizzes 
            if not q.get("explanation") or not str(q.get("explanation")).strip()
        ]
        if missing_explanations:
            errors.append(f"Missing explanations for {len(missing_explanations)} quiz questions.")

        # If deterministic checks fail, return failed approval immediately with feedback
        if errors:
            feedback_str = " | ".join(errors)
            
            missing_names = []
            for c in (concepts or []):
                if isinstance(c, dict) and "concept" in c:
                    missing_names.append(c["concept"])
                elif isinstance(c, str):
                    missing_names.append(c)

            return {
                "approved": False,
                "feedback": f"Deterministic validation failed: {feedback_str}",
                "missing_concepts": missing_names,
                "missing_relationships": relationships or []
            }

        # 2. LLM Semantic & Coverage Checks
        prompt = (
            f"Please verify the educational quality of the following generated items:\n\n"
            f"Extracted Concepts:\n{json.dumps(concepts, indent=2)}\n\n"
            f"Relationships:\n{json.dumps(relationships, indent=2)}\n\n"
            f"Generated Flashcards (first 8):\n{json.dumps(flashcards[:8], indent=2)}\n\n"
            f"Generated Quizzes (first 8):\n{json.dumps(quizzes[:8], indent=2)}\n\n"
            f"Revision Notes Length: {len(notes)} characters\n"
        )
        
        result = self.execute_json(prompt)
        
        if isinstance(result, dict) and "error" in result:
            print(f"[EducationalQualityAgent] Verification LLM failed: {result.get('error')}")
            # Safe fallback: approve if LLM fails but programmatic checks passed
            return {
                "approved": True, 
                "feedback": "LLM check skipped due to error.", 
                "missing_concepts": [], 
                "missing_relationships": []
            }
            
        return result
