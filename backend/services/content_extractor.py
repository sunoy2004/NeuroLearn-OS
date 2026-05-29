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
        "concepts": concepts if concepts else [],
    }


def _sentences_about_concept(transcript: str, concept: str, max_sentences: int = 3) -> List[str]:
    if not transcript:
        return []
    concept_lower = concept.lower()
    matched = []
    for sent in extract_sentences(transcript, 30):
        if concept_lower in sent.lower():
            matched.append(sent)
        if len(matched) >= max_sentences:
            break
    return matched


def _extract_from_notes(notes: str, concept: str, max_chars: int = 400) -> str:
    if not notes or not concept:
        return ""
    concept_lower = concept.lower()
    lines = notes.split("\n")
    block: List[str] = []
    capturing = False
    for line in lines:
        if concept_lower in line.lower():
            capturing = True
        if capturing:
            block.append(line.strip())
            if len("\n".join(block)) > max_chars:
                break
        if capturing and line.strip() == "" and len(block) > 2:
            break
    return "\n".join(block).strip()[:max_chars]


def generate_flashcards_heuristic(
    transcript: str,
    concepts: List[str],
    lang: str = "en",
    concepts_details: Optional[List[Dict[str, Any]]] = None,
    notes: str = "",
) -> List[Dict[str, str]]:
    """Generate content-rich flashcards from transcript, definitions, and notes."""
    details_map: Dict[str, Dict[str, Any]] = {}
    for d in concepts_details or []:
        if isinstance(d, dict) and d.get("concept"):
            details_map[d["concept"].lower()] = d

    cards: List[Dict[str, str]] = []
    seen_fronts: set[str] = set()

    for concept in concepts[:12]:
        detail = details_map.get(concept.lower(), {})
        definition = (detail.get("definition") or "").strip()
        related = detail.get("related_concepts") or []
        relevant_sents = _sentences_about_concept(transcript, concept, 3)
        notes_excerpt = _extract_from_notes(notes, concept)

        # Definition card — use actual lecture content
        if definition and len(definition) > 25 and "key concept" not in definition.lower()[:30]:
            back = definition
        elif relevant_sents:
            back = relevant_sents[0]
        elif notes_excerpt:
            back = notes_excerpt
        else:
            back = f"{concept} — review your lecture notes for a detailed explanation."

        front = f"What is {concept} and why does it matter?"
        if front not in seen_fronts:
            cards.append({"front": front, "back": back, "topic": concept})
            seen_fronts.add(front)

        # Application / detail card from second sentence
        if relevant_sents and len(relevant_sents) > 1:
            front2 = f"Explain how {concept} works based on your lecture."
            if front2 not in seen_fronts:
                cards.append({"front": front2, "back": relevant_sents[1], "topic": concept})
                seen_fronts.add(front2)
        elif notes_excerpt and len(notes_excerpt) > 60:
            front2 = f"Summarize the key details about {concept} from your study notes."
            if front2 not in seen_fronts:
                cards.append({"front": front2, "back": notes_excerpt[:500], "topic": concept})
                seen_fronts.add(front2)

        # Comparison card if related concepts exist
        if related:
            other = related[0] if isinstance(related[0], str) else str(related[0])
            front3 = f"How does {concept} differ from or relate to {other}?"
            other_sents = _sentences_about_concept(transcript, other, 1)
            back3 = (
                f"{concept} and {other} are related concepts covered in your lectures. "
                f"{other_sents[0] if other_sents else definition or back}"
            )
            if front3 not in seen_fronts:
                cards.append({"front": front3, "back": back3, "topic": concept})
                seen_fronts.add(front3)

    if not cards and transcript:
        for sent in extract_sentences(transcript, 6):
            front = f"From your lecture: what is the main idea in this statement?"
            cards.append({"front": front, "back": sent, "topic": "Lecture Content"})
            if len(cards) >= 8:
                break

    # When few concept cards, add transcript sentence cards for depth
    if len(cards) < 8 and transcript:
        for sent in extract_sentences(transcript, 12):
            if len(sent) < 40:
                continue
            front = f"Explain this from your lecture: \"{sent[:70]}...\""
            if front not in seen_fronts:
                topic = concepts[0] if concepts else "Lecture Content"
                cards.append({"front": front, "back": sent, "topic": topic})
                seen_fronts.add(front)
            if len(cards) >= 15:
                break

    return cards


def generate_quiz_heuristic(
    concepts: List[str],
    transcript: str = "",
    concepts_details: Optional[List[Dict[str, Any]]] = None,
    notes: str = "",
    count: int = 10,
) -> List[Dict[str, Any]]:
    """Generate multiple MCQ questions grounded in lecture content."""
    details_map: Dict[str, Dict[str, Any]] = {}
    for d in concepts_details or []:
        if isinstance(d, dict) and d.get("concept"):
            details_map[d["concept"].lower()] = d

    questions: List[Dict[str, Any]] = []
    pool = concepts if concepts else ["General Study"]

    q_templates = [
        lambda c, ctx: {
            "question": f"Which statement best describes {c} based on your lecture materials?",
            "options": [
                ctx[:120] if ctx else f"{c} is a core concept explained in your lectures",
                f"{c} is unrelated to this subject area",
                f"{c} has no practical applications",
                f"{c} was not discussed in any lecture",
            ],
            "correct": 0,
            "explanation": ctx[:200] if ctx else f"{c} was covered in your study materials.",
            "topic": c,
        },
        lambda c, ctx: {
            "question": f"What is the primary purpose or role of {c}?",
            "options": [
                f"It is fundamental to understanding the topic as explained in lecture",
                "It is only used in legacy systems",
                "It eliminates the need for other concepts",
                "It has no defined purpose",
            ],
            "correct": 0,
            "explanation": ctx[:200] if ctx else f"Review your notes on {c}.",
            "topic": c,
        },
        lambda c, ctx: {
            "question": f"True or False: {c} was identified as an important concept in your lectures.",
            "options": ["True", "False", "Partially true", "Not covered"],
            "correct": 0,
            "explanation": f"{c} appears in your lecture concepts and study materials.",
            "topic": c,
        },
    ]

    idx = 0
    while len(questions) < count:
        concept = pool[idx % len(pool)]
        detail = details_map.get(concept.lower(), {})
        definition = detail.get("definition", "")
        sents = _sentences_about_concept(transcript, concept, 1)
        notes_bit = _extract_from_notes(notes, concept, 200)
        ctx = definition or (sents[0] if sents else notes_bit)

        template = q_templates[len(questions) % len(q_templates)]
        q = template(concept, ctx)
        questions.append(q)
        idx += 1

    return questions[:count]


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
        concepts = extract_concepts_from_transcript(transcript) or []
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
