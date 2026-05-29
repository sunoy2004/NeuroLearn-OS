"""
QuizAgent — Generates structured quiz questions for spaced repetition testing.

Returns JSON array: [{"question", "options"[], "correct" (int), "explanation", "topic", "difficulty", "question_type", "related_concepts"[]}]
"""

import json
from typing import Dict, Any, Optional, List
from agent_service.agents.specialist_agent import SpecialistAgent
from agent_service.providers.interfaces.llm import LLMProvider

QUIZ_SYSTEM_PROMPT = """You are the Quiz Generation Agent for NeuroLearn OS.

Your job is to generate high-quality, diverse, and challenging academic quiz questions based on the provided lecture materials and the student's learning history.

You MUST support the following 10 question types:
1. **MCQ**: Standard multiple-choice questions with exactly 4 options.
2. **True/False**: True or false questions (options must be exactly ["True", "False"]).
3. **Fill in Blank**: Sentences with blank placeholders (options must be empty []).
4. **Short Answer**: Concept recall questions where answer is typed (options must be empty []).
5. **Concept Explanation**: Conceptual deep-dives requiring short text explanation (options must be empty []).
6. **Scenario Based**: Present a practical coding/design scenario and ask the best option/approach.
7. **Application Based**: How or where to apply a concept practically.
8. **Problem Solving**: Ask the student to solve a specific problem or trace an algorithm's execution.
9. **Comparison**: Questions that require comparing and contrasting two distinct concepts.
10. **Case Study Questions**: Mini case studies describing a complex architecture/system and asking analysis questions.

You MUST respond ONLY with a raw JSON array of objects (no markdown code fence blocks, no explanatory text). Each object in the JSON array must have exactly these keys:
- "question": the quiz question text
- "options": array of strings (exactly 4 options for MCQ/Scenario/Application/Comparison/Problem Solving/Case Study; exactly 2 options ["True", "False"] for True/False; empty array [] for Short Answer/Fill in Blank/Concept Explanation)
- "correct": the integer index of the correct option (0 for other types without options)
- "explanation": a detailed, helpful educational explanation of the answer
- "topic": the specific concept/topic name (e.g. "Normalization")
- "difficulty": must be exactly "Easy", "Medium", or "Hard"
- "question_type": must be one of: "MCQ", "True/False", "Fill in Blank", "Short Answer", "Concept Explanation", "Scenario Based", "Application Based", "Problem Solving", "Comparison", "Case Study"
- "related_concepts": array of strings (the names of related concepts)

Guidelines:
- Reject low-value or placeholder questions. Hard questions must require deep thinking, logical reasoning, and cannot be simple definitions (e.g., "What is a database?" is REJECTED).
- Incorporate user's learning history: if the student has weak topics, prioritize generating more questions (and more detailed explanations) on those weak topics. If they have strong topics, generate fewer basic questions and focus on advanced scenario-based questions.
- Write everything in the SAME language as the source materials.
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
        if isinstance(result, dict) and "error" in result:
            return {
                "question": f"What is a key concept in {topic}?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct": 0,
                "explanation": "Quiz generation failed. Please try again.",
                "topic": topic,
                "difficulty": "Medium",
                "question_type": "MCQ",
                "related_concepts": [topic]
            }
        return result

    def generate_quiz(
        self,
        topic: str,
        transcript: str = "",
        concepts: List[Dict[str, Any]] = None,
        notes: str = "",
        flashcards: List[Dict[str, Any]] = None,
        relationships: List[Dict[str, Any]] = None,
        learning_history: Dict[str, Any] = None,
        count: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> list:
        """Generate multiple quiz questions from topic and transcript context using multi-stage context."""
        word_count = len(transcript.split()) if transcript else 0
        if count is None:
            if word_count < 500:
                count = 10
            elif word_count < 2000:
                count = 20
            else:
                count = 35

        easy_count = max(1, int(count * 0.2))
        hard_count = max(1, int(count * 0.3))
        medium_count = count - easy_count - hard_count

        prompt = (
            f"Generate exactly {count} quiz questions, distributed as follows:\n"
            f"- {easy_count} Easy questions\n"
            f"- {medium_count} Medium questions\n"
            f"- {hard_count} Hard questions\n\n"
            f"IMPORTANT: Use your expert academic knowledge of '{topic}'. The student may NOT have "
            f"lecture notes on this topic — generate complete, accurate questions from your own knowledge.\n"
            f"Do NOT reference 'lecture materials' or say content was 'covered in class'.\n\n"
            f"Mix the 10 specified question types. Integrate the student's historical performance "
            f"to customize the questions (e.g., reinforce weak topics and skip basic questions on strong topics).\n\n"
            f"Context Materials (optional enrichment — ignore if empty or irrelevant):\n"
            f"Target Topic: {topic}\n"
            f"Extracted Concepts:\n{json.dumps(concepts or [], indent=2)}\n\n"
            f"Concept Relationships (Knowledge Graph):\n{json.dumps(relationships or [], indent=2)}\n\n"
            f"Spaced-Repetition Flashcards:\n{json.dumps(flashcards or [], indent=2)}\n\n"
            f"Revision Notes:\n{notes}\n\n"
            f"Lecture Spoken Transcript:\n{transcript}\n\n"
            f"Student Learning History:\n{json.dumps(learning_history or {}, indent=2)}\n"
        )
        
        result = self.execute_json(prompt, context)
        
        if isinstance(result, list):
            return result
        if isinstance(result, dict) and "questions" in result:
            return result["questions"]
        if isinstance(result, dict) and "error" not in result and "question" in result:
            return [result]
        return []
