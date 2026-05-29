"""
LLM-first study service — teaches and quizzes on ANY academic topic using LLM knowledge.
Local DB / lecture notes are optional enrichment, never a hard requirement.
"""
import json
from typing import Any, Dict, List, Optional

from backend.services.lyzr_client import get_agent_lyzr_credentials, is_lyzr_configured, lyzr_agent_execute, lyzr_chat
from backend.services.content_extractor import _clean_json


TUTOR_SYSTEM = """You are the Adaptive Tutor Agent for NeuroLearn OS — a world-class academic teacher.

CRITICAL: You can teach ANY study-related topic using your expert knowledge. You are NOT limited to
the student's recorded lectures. If they ask about Agent AI, quantum computing, DBMS, or anything
academic — explain it fully from your own knowledge.

Pedagogical structure for explanations:
1. **Definition** — clear, accurate definition
2. **Key Concepts** — 3-5 bullet points covering the important ideas
3. **Simple Example** — concrete example demonstrating the concept
4. **Real-World Analogy** — intuitive analogy from daily life
5. **Quick Check** — one short question to test understanding (don't give the answer yet)

Guidelines:
- Be warm, encouraging, and thorough (3-5 paragraphs for teaching requests)
- Use markdown formatting for readability
- Match the student's language
- If optional local lecture notes are provided, weave them in as bonus context — but NEVER refuse
  to answer because notes are missing
- For greetings, respond warmly and offer to teach any topic"""


QUIZ_SYSTEM = """You are the Quiz Intelligence Agent for NeuroLearn OS.

CRITICAL: Generate quiz questions using your expert academic knowledge of the requested topic.
The student may ask about topics NOT in their lecture database. You must still produce excellent,
challenging questions from your own knowledge.

Requirements:
- Each MCQ has exactly 4 plausible options with one clearly correct answer
- Questions test understanding: definitions, applications, comparisons, scenarios, problem-solving
- Mix Easy / Medium / Hard difficulties
- Detailed explanations that teach, not just confirm the answer
- NEVER say "based on your lecture" or "not covered in materials"
- NEVER use placeholder options like "Option A" or generic filler

Respond ONLY with a raw JSON array (no markdown fences):
[{"question": string, "options": string[4], "correct": int, "explanation": string, "topic": string, "difficulty": string, "question_type": "MCQ"}]"""


def explain_study_topic(message: str, context: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Explain or teach any study topic via Lyzr tutor agent."""
    api_key, agent_id = get_agent_lyzr_credentials("TUTOR")
    if not is_lyzr_configured(api_key, agent_id):
        return None

    enriched = message
    if context:
        local = context.get("localLectureContext")
        if local:
            enriched = (
                f"{message}\n\n"
                f"[Optional local notes from student's recordings — supplement if useful, "
                f"but teach fully from your knowledge regardless]:\n{local[:3500]}"
            )
        style = context.get("learningStyle")
        if style:
            enriched = f"[Adapt to learning style: {style}]\n\n{enriched}"

    try:
        return lyzr_agent_execute("TUTOR", "Adaptive Tutor", TUTOR_SYSTEM, enriched, context)
    except Exception as e:
        print(f"[LLMStudy] lyzr_agent_execute tutor failed: {e}")
        try:
            return lyzr_chat(api_key, agent_id, f"{TUTOR_SYSTEM}\n\nStudent: {enriched}")
        except Exception as e2:
            print(f"[LLMStudy] lyzr_chat tutor failed: {e2}")
            return None


def _parse_quiz_json(raw: str) -> List[Dict[str, Any]]:
    if not raw:
        return []
    try:
        data = json.loads(_clean_json(raw.strip()))
    except Exception:
        start = raw.find("[")
        end = raw.rfind("]")
        if start >= 0 and end > start:
            try:
                data = json.loads(raw[start : end + 1])
            except Exception:
                return []
        else:
            return []

    if isinstance(data, dict):
        if "questions" in data:
            data = data["questions"]
        elif "question" in data:
            data = [data]
        else:
            return []

    if not isinstance(data, list):
        return []

    valid = []
    for q in data:
        if not isinstance(q, dict) or not q.get("question"):
            continue
        opts = q.get("options") or []
        if len(opts) < 2:
            continue
        while len(opts) < 4:
            opts.append(f"Alternative {len(opts)}")
        valid.append({
            "question": q["question"],
            "options": opts[:4],
            "correct": min(int(q.get("correct", 0)), 3),
            "explanation": q.get("explanation", ""),
            "topic": q.get("topic", ""),
            "difficulty": q.get("difficulty", "Medium"),
            "question_type": q.get("question_type", "MCQ"),
        })
    return valid


def _generate_quiz_via_quiz_agent(topic: str, count: int, local_context: str) -> List[Dict[str, Any]]:
    try:
        from agent_service.providers.agent_provider_factory import get_agent_llm
        from agent_service.agents.quiz_agent import QuizAgent

        agent = QuizAgent(get_agent_llm("quiz"))
        return agent.generate_quiz(
            topic=topic,
            transcript=local_context or f"Academic topic for quiz generation: {topic}",
            concepts=[{
                "concept": topic,
                "definition": f"Academic subject area: {topic}. Generate questions from expert knowledge.",
                "importance": "High",
                "related_concepts": [],
            }],
            notes=local_context,
            count=count,
        )
    except Exception as e:
        print(f"[LLMStudy] QuizAgent fallback failed: {e}")
        return []


def generate_quiz_open_world(
    topic: str,
    count: int = 10,
    local_context: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Generate quiz questions from LLM knowledge — DB content is optional enrichment only."""
    topic_clean = (topic or "General").strip()
    count = max(10, min(count, 25))

    context_block = ""
    if local_context and len(local_context.strip()) > 50:
        context_block = (
            f"\n\nOptional notes from student recordings (enrich if relevant):\n{local_context[:5000]}"
        )

    user_prompt = (
        f"Generate exactly {count} multiple-choice quiz questions about: **{topic_clean}**\n"
        f"Use your full expert knowledge of this topic. Cover fundamentals, applications, "
        f"comparisons, and scenario-based questions.\n"
        f"Difficulty mix: ~20% Easy, ~50% Medium, ~30% Hard.{context_block}"
    )

    api_key, agent_id = get_agent_lyzr_credentials("QUIZ")
    if is_lyzr_configured(api_key, agent_id):
        try:
            raw = lyzr_agent_execute("QUIZ", "Quiz Agent", QUIZ_SYSTEM, user_prompt)
            parsed = _parse_quiz_json(raw)
            if parsed and len(parsed) >= min(count, 5):
                return parsed[:count]
        except Exception as e:
            print(f"[LLMStudy] Lyzr open-world quiz failed: {e}")

    agent_result = _generate_quiz_via_quiz_agent(topic_clean, count, local_context or "")
    if agent_result:
        return agent_result[:count]
    return []
