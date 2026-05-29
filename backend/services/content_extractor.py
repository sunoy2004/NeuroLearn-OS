"""
Lightweight transcript content extraction — no fake/dummy data.
Uses NLP heuristics when LLM is unavailable.
"""
import re
import json
from typing import List, Dict, Any, Tuple, Optional

from concept_keywords import extract_concepts_from_text
from backend.services.language_utils import (
    prompt_with_language,
    resolve_language,
    notes_labels,
    language_display_name,
)


def _clean_json(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def extract_concepts_from_transcript(transcript: str, max_concepts: int = 8) -> List[str]:
    """Extract academic concepts using shared keyword patterns."""
    return extract_concepts_from_text(transcript, max_concepts)


def extract_sentences(transcript: str, max_sentences: int = 5) -> List[str]:
    sentences = re.split(r'(?<=[.!?])\s+', transcript.strip())
    return [s.strip() for s in sentences if len(s.strip()) > 20][:max_sentences]


def generate_title_from_concepts(concepts: list, transcript: str, fallback_title: str = "Lecture") -> str:
    """Generate a meaningful lecture title from detected concepts and transcript content."""
    if not concepts:
        # Try to extract a topic from the first substantial sentence
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', transcript.strip()) if len(s.strip()) > 20]
        if sentences:
            # Use first sentence keywords
            first = sentences[0]
            words = [w for w in first.split() if len(w) > 3 and w[0].isupper()]
            if words:
                return " ".join(words[:4])
        return fallback_title

    # Build title from top concepts
    if len(concepts) == 1:
        return f"Introduction to {concepts[0]}"
    elif len(concepts) == 2:
        return f"{concepts[0]} and {concepts[1]}"
    else:
        # Group by theme: use first 2-3 most significant
        primary = concepts[0]
        secondary = concepts[1]
        return f"{primary}, {secondary} & Related Concepts"


def generate_summary_heuristic(transcript: str, title: str = "Lecture") -> Dict[str, Any]:
    """Generate summary from transcript without LLM."""
    concepts = extract_concepts_from_transcript(transcript)
    key_sentences = extract_sentences(transcript, 3)

    # Generate meaningful title from content instead of echoing input
    is_generic_title = (
        title.startswith("Lecture -") or
        title.startswith("Lecture ") or
        title.lower() in ("lecture", "auto-detect", "")
    )
    generated_title = generate_title_from_concepts(concepts, transcript, title) if is_generic_title else title

    if key_sentences:
        summary = " ".join(key_sentences)
        if len(summary) > 500:
            summary = summary[:497] + "..."
    elif concepts:
        summary = f"This lecture covered {', '.join(concepts[:4])}."
    else:
        word_count = len(transcript.split())
        summary = f"Lecture recording captured {word_count} words of content on {generated_title}."

    return {
        "title": generated_title,
        "summary": summary,
        "concepts": concepts if concepts else ["General Study Material"],
    }


def generate_flashcards_heuristic(transcript: str, concepts: List[str], lang: str = "en") -> List[Dict[str, str]]:
    cards = []
    lang_name = language_display_name(lang)
    for concept in concepts[:5]:
        if lang == "hi":
            front, back = f"{concept} क्या है?", f"{concept} इस व्याख्यान में चर्चा किया गया एक मुख्य विषय है।"
        elif lang == "bn":
            front, back = f"{concept} কী?", f"{concept} এই লেকচারে আলোচিত একটি মূল ধারণা।"
        elif lang == "fr":
            front, back = f"Qu'est-ce que {concept}?", f"{concept} est un concept clé abordé dans ce cours."
        else:
            front, back = f"What is {concept}?", f"{concept} is a key concept discussed in this lecture."
        cards.append({"front": front, "back": back, "topic": concept})

    if not cards and transcript:
        sentences = extract_sentences(transcript, 2)
        for i, sent in enumerate(sentences):
            cards.append({
                "front": f"Explain the following from the lecture: \"{sent[:60]}...\"",
                "back": sent,
                "topic": "Lecture Content",
            })
    return cards


def generate_quiz_heuristic(concepts: List[str]) -> List[Dict[str, Any]]:
    questions = []
    for concept in concepts[:3]:
        questions.append({
            "question": f"Which statement best describes {concept}?",
            "options": [
                f"{concept} is a core concept covered in this lecture",
                f"{concept} is unrelated to this subject",
                f"{concept} has been deprecated in modern systems",
                "None of the above",
            ],
            "correct": 0,
            "explanation": f"{concept} was identified as a key topic in your lecture transcript.",
            "topic": concept,
        })
    return questions


def generate_notes_heuristic(transcript: str, concepts: List[str], title: str, subject: str, lang: str = "en") -> str:
    labels = notes_labels(lang)
    lines = [
        f"### {title} — {labels['title']}",
        "",
        f"**{labels['subject']}:** {subject}",
        f"**{labels['words']}:** {len(transcript.split())}",
        "",
        f"#### {labels['concepts']}",
    ]
    for c in concepts:
        lines.append(f"- **{c}**")

    lines.extend(["", f"#### {labels['content']}", ""])
    for sent in extract_sentences(transcript, 8):
        lines.append(f"- {sent}")

    lines.extend(["", f"#### {labels['revision']}", ""])
    if lang == "hi":
        lines.extend(["- ऊपर दी गई प्रत्येक अवधारणा की समीक्षा करें", "- फ़्लैशकार्ड से खुद को परखें"])
    elif lang == "bn":
        lines.extend(["- উপরের প্রতিটি ধারণা পুনরালোচনা করুন", "- ফ্ল্যাশকার্ড দিয়ে নিজেকে পরীক্ষা করুন"])
    elif lang == "fr":
        lines.extend(["- Révisez chaque concept ci-dessus", "- Testez-vous avec les flashcards générées"])
    else:
        lines.extend(["- Review each concept definition above", "- Test yourself with generated flashcards"])

    return "\n".join(lines)


async def process_transcript_with_llm_or_heuristic(
    transcript: str,
    title: str,
    subject: str,
    groq_key: str | None,
    groq_model: str = "llama-3.3-70b-versatile",
    language_hint: Optional[str] = None,
) -> Tuple[Dict, List, List, str]:
    """
    Returns (summary_data, flashcards_data, quiz_data, raw_notes).
    Prefers Lyzr agents, then Groq LLM, then heuristic extraction.
    """
    import asyncio
    from backend.services.lyzr_content_pipeline import (
        is_lyzr_lecture_pipeline_available,
        process_transcript_with_lyzr,
    )

    lang = resolve_language(transcript, language_hint)

    if is_lyzr_lecture_pipeline_available():
        try:
            return await asyncio.to_thread(
                process_transcript_with_lyzr, transcript, title, subject, language_hint
            )
        except Exception as e:
            print(f"[ContentExtractor] Lyzr pipeline failed, falling back: {e}")

    if not groq_key or "dummy" in groq_key:
        summary_data = generate_summary_heuristic(transcript, title)
        concepts = summary_data["concepts"]
        flashcards_data = generate_flashcards_heuristic(transcript, concepts, lang)
        quiz_data = generate_quiz_heuristic(concepts)
        raw_notes = generate_notes_heuristic(transcript, concepts, title, subject, lang)
        return summary_data, flashcards_data, quiz_data, raw_notes

    from openai import OpenAI
    client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")

    sum_prompt = prompt_with_language(
        "Summarize this lecture transcript. Respond with JSON only: "
        '{"title": string, "summary": string, "concepts": string[]}\n\n'
        f"Transcript:\n{transcript[:8000]}",
        transcript,
        language_hint,
    )
    response = client.chat.completions.create(
        model=groq_model,
        messages=[{"role": "user", "content": sum_prompt}],
        temperature=0.2,
    )
    raw_sum = _clean_json(response.choices[0].message.content.strip())
    try:
        summary_data = json.loads(raw_sum)
    except Exception:
        summary_data = generate_summary_heuristic(transcript, title)

    concepts = summary_data.get("concepts") or extract_concepts_from_transcript(transcript)
    if not concepts:
        concepts = extract_concepts_from_transcript(transcript) or ["General Study Material"]
    summary_data["concepts"] = concepts

    fc_prompt = prompt_with_language(
        "Generate 3-5 flashcards as JSON array: [{front, back, topic}]\n"
        f"Concepts: {concepts}\nTranscript: {transcript[:4000]}",
        transcript,
        language_hint,
    )
    response_fc = client.chat.completions.create(
        model=groq_model, messages=[{"role": "user", "content": fc_prompt}], temperature=0.3
    )
    try:
        flashcards_data = json.loads(_clean_json(response_fc.choices[0].message.content.strip()))
    except Exception:
        flashcards_data = generate_flashcards_heuristic(transcript, concepts, lang)

    quiz_prompt = prompt_with_language(
        "Generate 2-3 MCQ questions as JSON array: "
        "[{question, options: string[4], correct: int, explanation, topic}]\n"
        f"Concepts: {concepts}\nTranscript: {transcript[:4000]}",
        transcript,
        language_hint,
    )
    response_q = client.chat.completions.create(
        model=groq_model, messages=[{"role": "user", "content": quiz_prompt}], temperature=0.3
    )
    try:
        quiz_data = json.loads(_clean_json(response_q.choices[0].message.content.strip()))
    except Exception:
        quiz_data = generate_quiz_heuristic(concepts)

    notes_prompt = prompt_with_language(
        "Generate detailed Markdown study notes from this transcript. No code fences. "
        "Use the same language as the transcript for all headings and content.\n"
        f"Concepts: {concepts}\nTranscript: {transcript[:6000]}",
        transcript,
        language_hint,
    )
    try:
        response_notes = client.chat.completions.create(
            model=groq_model, messages=[{"role": "user", "content": notes_prompt}], temperature=0.3
        )
        raw_notes = response_notes.choices[0].message.content.strip()
    except Exception:
        raw_notes = generate_notes_heuristic(transcript, concepts, title, subject, lang)

    return summary_data, flashcards_data, quiz_data, raw_notes
