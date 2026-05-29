"""
QuizAgent — Generates structured quiz questions for spaced repetition testing.

Returns JSON array: [{"question", "options"[], "correct" (int), "explanation", "topic", "difficulty", "question_type"}]
"""

from typing import Dict, Any, Optional, List
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

QUIZ_SYSTEM_PROMPT = """You are the Quiz Generation Agent for NeuroLearn OS.

Your job is to generate high-quality, diverse academic quiz questions for student assessment.

For each lecture, you MUST generate at least 30 questions (exactly 10 Easy, 10 Medium, and 10 Hard questions).

You MUST generate questions across the following diverse types:
1. **MCQ**: Standard multiple-choice questions with exactly 4 options.
2. **True/False**: True or false questions (options must be exactly ["True", "False"]).
3. **Short Answer**: Concept recall questions where options is empty.
4. **Fill in Blank**: Sentences with blank placeholders, options is empty.
5. **Concept Explanation**: Conceptual deep-dives, options is empty.
6. **Scenario Based**: Present a coding/design scenario and ask the best option/approach.
7. **Application Based**: How or where to apply a concept practically.

You MUST respond ONLY with a raw JSON array of objects (no markdown code fence blocks, no explanatory text). Each object in the JSON array must have exactly these keys:
- "question": the quiz question text
- "options": array of strings (exactly 4 options for MCQ/Scenario/Application; exactly 2 options ["True", "False"] for True/False; empty array [] for Short Answer/Fill in Blank/Concept Explanation)
- "correct": the integer index of the correct option (0 for other types)
- "explanation": a detailed, helpful educational explanation of the answer
- "topic": the specific concept/topic name (e.g. "Normalization")
- "difficulty": must be exactly "Easy", "Medium", or "Hard"
- "question_type": must be one of: "MCQ", "True/False", "Short Answer", "Fill in Blank", "Concept Explanation", "Scenario Based", "Application Based"

Guidelines:
- Make distractors plausible and testing typical student misconceptions.
- Adjust complexity dynamically to the topic.
- Write everything in the SAME language as the source text.
"""


class QuizAgent(SpecialistAgent):
    def __init__(self, llm: LLMProvider):
        super().__init__(
            name="Quiz Generation Agent",
            system_prompt=QUIZ_SYSTEM_PROMPT,
            llm=llm
        )

    def generate_question(self, topic: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate a single quiz question for the given topic."""
        result = self.execute_json(f"Generate a quiz question about: {topic}", context)
        if "error" in result:
            return {
                "question": f"What is a key concept in {topic}?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct": 0,
                "explanation": "Quiz generation failed. Please try again.",
                "topic": topic,
                "difficulty": "Medium",
                "question_type": "MCQ"
            }
        return result

    def generate_quiz(self, topic: str, transcript: str = "", count: int = 30) -> list:
        """Generate multiple quiz questions from topic and transcript context (aims for 30 questions)."""
        prompt = (
            f"Generate a full set of {count} questions (10 Easy, 10 Medium, 10 Hard) "
            f"covering various types about '{topic}' using this transcript content:\n\n{transcript[:4000]}"
        )
        result = self.execute_json(prompt)
        
        if isinstance(result, list):
            return result
        if isinstance(result, dict) and "questions" in result:
            return result["questions"]
        if isinstance(result, dict) and "error" not in result and "question" in result:
            return [result]
        return []
