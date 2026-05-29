"""
TranscriptProcessor — Unified transcript intelligence pipeline.

Processes raw transcripts in stages:
1. Clean transcript (remove duplicate words, filler words, normalize punctuation/casing)
2. Segment transcript into topic sections
3. Classify overall title & category (via ClassificationAgent or heuristic)
4. Extract academic concepts with definitions, importance, and relationships (via ConceptAgent)
5. Generate hierarchical summaries per section and merge them
6. Generate Markdown study notes (via NotesAgent) from merged summaries
7. Generate 20-50 flashcards (via FlashcardAgent)
8. Generate 30+ quiz questions (via QuizAgent)

Each stage has fallback to NLP heuristics when LLM is unavailable.
"""

import re
import uuid
from typing import Dict, Any, List, Optional, Tuple

from concept_keywords import extract_concepts_from_text
from backend.services.content_extractor import (
    generate_summary_heuristic,
    generate_notes_heuristic,
    generate_flashcards_heuristic,
    generate_quiz_heuristic,
)
from backend.services.language_utils import resolve_language

from agent_service.providers.agent_provider_factory import get_agent_llm
from agent_service.agents.classification_agent import ClassificationAgent
from agent_service.agents.concept_agent import ConceptAgent
from agent_service.agents.summary_agent import SummaryAgent
from agent_service.agents.notes_agent import NotesAgent
from agent_service.agents.flashcard_agent import FlashcardAgent
from agent_service.agents.quiz_agent import QuizAgent


class TranscriptProcessingResult:
    def __init__(
        self,
        title: str,
        category: str,
        concepts: List[str],               # List of concept names (strings)
        concepts_details: List[Dict[str, Any]],  # List of concept dicts with definition/importance
        relationships: List[Dict[str, Any]],
        summary: str,
        notes: str,
        flashcards: List[Dict[str, Any]],
        quizzes: List[Dict[str, Any]],
        language: str,
    ):
        self.title = title
        self.category = category
        self.concepts = concepts
        self.concepts_details = concepts_details
        self.relationships = relationships
        self.summary = summary
        self.notes = notes
        self.flashcards = flashcards
        self.quizzes = quizzes
        self.language = language

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "category": self.category,
            "concepts": self.concepts,
            "concepts_details": self.concepts_details,
            "relationships": self.relationships,
            "summary": self.summary,
            "notes": self.notes,
            "flashcardCount": len(self.flashcards),
            "quizCount": len(self.quizzes),
            "language": self.language,
        }


def clean_transcript(text: str) -> str:
    """Clean speech repetitions, normalized spaces, filler words, and sentence boundaries."""
    if not text:
        return ""
    
    # 1. Remove common filler words
    fillers = [r'\bum\b', r'\buh\b', r'\beh\b', r'\byou know\b', r'\blike\b', r'\bbasically\b']
    cleaned = text.strip()
    for filler in fillers:
        cleaned = re.sub(filler, '', cleaned, flags=re.IGNORECASE)
        
    # 2. Remove consecutive duplicate words (e.g. "database database" -> "database")
    cleaned = re.sub(r'\b([a-zA-Z0-9_\'\-]+)\s+\1\b', r'\1', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b([a-zA-Z0-9_\'\-]+)\s+\1\b', r'\1', cleaned, flags=re.IGNORECASE) # run twice
    
    # 3. Normalize spacing
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    # 4. Sentence casing and punctuation
    sentences = re.split(r'(?<=[.!?])\s+', cleaned)
    cased_sentences = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        # Capitalize first letter
        s = s[0].upper() + s[1:]
        # Append period if missing
        if not s[-1] in ('.', '!', '?'):
            s += '.'
        cased_sentences.append(s)
        
    return ' '.join(cased_sentences)


def segment_transcript(text: str, subject: str = "Lecture") -> List[Dict[str, str]]:
    """Heuristically segment transcript text into distinct topic sections based on transition phrases."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sections = []
    current_title = f"{subject} Fundamentals"
    current_content = []
    
    transition_pattern = re.compile(
        r'\b(now let\'s (?:look at|talk about|discuss|explore|turn our attention to)|moving on to|next is|another key concept is|secondly,|firstly,|finally,|let\'s discuss|we will now examine|let\'s look at)\b',
        re.IGNORECASE
    )
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        if transition_pattern.search(sentence) and len(current_content) >= 3:
            sections.append({
                "title": current_title,
                "content": " ".join(current_content)
            })
            
            # Heuristically extract title
            new_title = "Related Concept"
            topic_match = re.search(r'(?:about|discuss|examine|at|to)\s+([A-Za-z0-9\s]+)(?:\.|\?|!|$|,)', sentence, re.IGNORECASE)
            if topic_match and topic_match.group(1):
                extracted = topic_match.group(1).strip()
                if len(extracted.split()) <= 4:
                    new_title = extracted.title()
            current_title = new_title
            current_content = [sentence]
        else:
            current_content.append(sentence)
            
    if current_content:
        sections.append({
            "title": current_title,
            "content": " ".join(current_content)
        })
        
    return [s for s in sections if len(s["content"].strip()) > 10]


class TranscriptProcessor:
    def __init__(self):
        # Lazy load agent LLMs isolated per specialist
        self.classification_agent = ClassificationAgent(get_agent_llm("lecture"))
        self.concept_agent = ConceptAgent(get_agent_llm("knowledge_graph"))
        self.summary_agent = SummaryAgent(get_agent_llm("summary"))
        self.notes_agent = NotesAgent(get_agent_llm("notes"))
        self.flashcard_agent = FlashcardAgent(get_agent_llm("flashcard"))
        self.quiz_agent = QuizAgent(get_agent_llm("quiz"))

    def process(
        self,
        raw_transcript: str,
        title_hint: str,
        subject: str,
        language_hint: Optional[str] = None,
    ) -> TranscriptProcessingResult:
        """Run the multi-stage transcript processing pipeline with robust fallbacks."""
        # 1. Clean transcript
        transcript = clean_transcript(raw_transcript)
        lang = resolve_language(transcript, language_hint)

        if not transcript or len(transcript) < 10:
            return TranscriptProcessingResult(
                title=title_hint or "Study Session",
                category="General",
                concepts=["General Study Material"],
                concepts_details=[],
                relationships=[],
                summary="Transcript too short to process.",
                notes="Short transcript session recording.",
                flashcards=[],
                quizzes=[],
                language=lang,
            )

        # 2. Segment transcript into topic sections
        sections = segment_transcript(transcript, subject)

        # 3. Title & Category Classification
        title = title_hint
        category = "General"
        tags = []
        try:
            classification = self.classification_agent.classify_lecture(transcript)
            title = classification.get("title", title_hint)
            category = classification.get("category", "General")
            tags = classification.get("tags", [])
        except Exception as e:
            print(f"[TranscriptProcessor] Classification stage failed: {e}")

        # Fallback if title is empty or generic
        is_generic_title = (
            not title or
            title.startswith("Lecture -") or
            title.startswith("Lecture ") or
            title.lower() in ("lecture", "auto-detect", "")
        )
        if is_generic_title:
            try:
                heuristic_data = generate_summary_heuristic(transcript, title_hint)
                title = heuristic_data.get("title", title_hint or "Lecture Summary")
            except Exception:
                title = title_hint or "Study Lecture"

        # 4. Multi-stage Concept & Relation Extraction
        concepts_details = []
        relationships = []
        try:
            concept_data = self.concept_agent.extract_concepts(transcript)
            concepts_details = concept_data.get("concepts", [])
            relationships = concept_data.get("relationships", [])
        except Exception as e:
            print(f"[TranscriptProcessor] Concept stage failed: {e}")

        # Map details to concept names (list of strings)
        concept_names = []
        for item in concepts_details:
            if isinstance(item, dict) and "concept" in item:
                concept_names.append(item["concept"])
            elif isinstance(item, str):
                concept_names.append(item)

        if not concept_names:
            concept_names = extract_concepts_from_text(transcript, max_concepts=8)
            if not concept_names:
                concept_names = tags if tags else ["General Study Material"]
            
            # Repopulate detailed format for fallback
            concepts_details = []
            for i, name in enumerate(concept_names):
                concepts_details.append({
                    "concept": name,
                    "definition": f"Core concept representing {name} within {subject}.",
                    "importance": "High" if i < 3 else "Medium",
                    "related_concepts": [n for n in concept_names if n != name][:3]
                })

        # 5. Hierarchical Summarization
        # Generate summary per section, then merge
        section_summaries = []
        for sec in sections:
            try:
                sec_sum = self.summary_agent.summarize(sec["content"])
                sec_summary_text = sec_sum.get("summary", "")
                if sec_summary_text:
                    section_summaries.append(f"Section '{sec['title']}': {sec_summary_text}")
            except Exception:
                pass

        if section_summaries:
            merged_summary_input = "\n\n".join(section_summaries)
        else:
            merged_summary_input = transcript

        # Generate overall merged summary
        summary = ""
        try:
            summary_data = self.summary_agent.summarize(merged_summary_input)
            summary = summary_data.get("summary", "")
        except Exception as e:
            print(f"[TranscriptProcessor] Summary stage failed: {e}")

        if not summary or len(summary.strip()) < 15 or "failed" in summary.lower()[:30]:
            try:
                heuristic_data = generate_summary_heuristic(transcript, title)
                summary = heuristic_data.get("summary", "")
            except Exception:
                summary = f"Study recording on {title} containing {len(transcript.split())} words."

        # 6. Notes Generation (from merged summaries)
        notes = ""
        try:
            notes = self.notes_agent.generate_notes(merged_summary_input)
        except Exception as e:
            print(f"[TranscriptProcessor] Notes stage failed: {e}")

        if not notes or len(notes.strip()) < 20 or "too short" in notes.lower()[:30]:
            notes = generate_notes_heuristic(transcript, concept_names, title, subject, lang)

        # 7. Flashcard Generation (Aim for 20-50 cards)
        flashcards = []
        try:
            flashcards = self.flashcard_agent.generate_cards(transcript)
        except Exception as e:
            print(f"[TranscriptProcessor] Flashcard stage failed: {e}")

        if not flashcards or len(flashcards) < 5:
            # Fallback to heuristic
            flashcards = generate_flashcards_heuristic(transcript, concept_names, lang)

        # 8. Quiz Generation (Aim for 30+ questions)
        quizzes = []
        try:
            quizzes = self.quiz_agent.generate_quiz(title, transcript, count=30)
        except Exception as e:
            print(f"[TranscriptProcessor] Quiz stage failed: {e}")

        if not quizzes or len(quizzes) < 5:
            quizzes = generate_quiz_heuristic(concept_names)

        return TranscriptProcessingResult(
            title=title,
            category=category,
            concepts=concept_names,
            concepts_details=concepts_details,
            relationships=relationships,
            summary=summary,
            notes=notes,
            flashcards=flashcards,
            quizzes=quizzes,
            language=lang,
        )
