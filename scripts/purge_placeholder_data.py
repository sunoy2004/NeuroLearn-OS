"""Remove placeholder 'General Study Material' and shallow generic flashcards/quizzes."""
import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "neurolearn.db"

PLACEHOLDER_TOPICS = (
    "general study material",
    "general",
    "lecture content",
)

SHALLOW_BACK_PATTERNS = (
    "is a key concept discussed in this lecture",
    "was covered in your lecture materials on",
    "is a core concept covered in this lecture",
    "key concept representing general study material",
)


def is_placeholder_topic(topic: str) -> bool:
    if not topic:
        return True
    t = topic.lower().strip()
    return t in PLACEHOLDER_TOPICS or "general study material" in t


def is_shallow_flashcard(front: str, back: str) -> bool:
    f = (front or "").lower()
    b = (back or "").lower()
    if "general study material" in f or "general study material" in b:
        return True
    if f.startswith("what is ") and any(p in b for p in SHALLOW_BACK_PATTERNS):
        return True
    return False


def is_shallow_quiz(question: str) -> bool:
    q = (question or "").lower()
    return "general study material" in q or "based on your lecture materials" in q


def main():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Flashcards
    c.execute("SELECT id, front, back, topic FROM flashcards")
    fc_rows = c.fetchall()
    fc_delete = [
        row[0] for row in fc_rows
        if is_placeholder_topic(row[3]) or is_shallow_flashcard(row[1], row[2])
    ]
    if fc_delete:
        c.executemany("DELETE FROM flashcards WHERE id = ?", [(i,) for i in fc_delete])
    print(f"Deleted {len(fc_delete)} placeholder/shallow flashcards")

    # Quiz questions
    c.execute("SELECT id, question, topic FROM quiz_questions")
    q_rows = c.fetchall()
    q_delete = [
        row[0] for row in q_rows
        if is_placeholder_topic(row[2]) or is_shallow_quiz(row[1])
    ]
    if q_delete:
        c.executemany("DELETE FROM quiz_questions WHERE id = ?", [(i,) for i in q_delete])
    print(f"Deleted {len(q_delete)} placeholder/shallow quiz questions")

    # Concepts
    c.execute("SELECT id, name FROM concepts")
    con_delete = [
        row[0] for row in c.fetchall()
        if is_placeholder_topic(row[1])
    ]
    if con_delete:
        c.executemany("DELETE FROM concepts WHERE id = ?", [(i,) for i in con_delete])
    print(f"Deleted {len(con_delete)} placeholder concepts")

    # Lectures — only if topics are purely placeholder or title is generic with no real notes
    c.execute("SELECT id, title, topics_json, summary, notes FROM lectures")
    lec_delete = []
    for lec_id, title, topics_json, summary, notes in c.fetchall():
        try:
            topics = json.loads(topics_json or "[]")
        except Exception:
            topics = []
        only_placeholder = (
            not topics
            or all(is_placeholder_topic(t) for t in topics)
        )
        if only_placeholder and not (notes and len(notes.strip()) > 100):
            lec_delete.append(lec_id)
    if lec_delete:
        c.executemany("DELETE FROM transcript_chunks WHERE lecture_id = ?", [(i,) for i in lec_delete])
        c.executemany("DELETE FROM lectures WHERE id = ?", [(i,) for i in lec_delete])
    print(f"Deleted {len(lec_delete)} placeholder lectures (+ transcript chunks)")

    conn.commit()

    c.execute("SELECT COUNT(*) FROM flashcards")
    print(f"Remaining flashcards: {c.fetchone()[0]}")
    c.execute("SELECT COUNT(*) FROM quiz_questions")
    print(f"Remaining quiz questions: {c.fetchone()[0]}")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
