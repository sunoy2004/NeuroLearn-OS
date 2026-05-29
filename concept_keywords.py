"""
Shared academic concept extraction — used by backend and agent_service.
Keyword patterns for DBMS, OS, DSA, and general CS topics.
"""
import re
from collections import Counter
from typing import List

CONCEPT_KEYWORD_PATTERNS: dict[str, str] = {
    # DBMS
    r"\bbcnf\b": "BCNF",
    r"\bboyce-codd\b": "BCNF",
    r"\b3nf\b": "Third Normal Form",
    r"\b2nf\b": "Second Normal Form",
    r"\b1nf\b": "First Normal Form",
    r"\bnormali[sz]ation\b": "Normalization",
    r"\bfunctional dependenc": "Functional Dependencies",
    r"\bb\+?\s*tree\b": "B+ Tree",
    r"\bacid\b": "ACID Properties",
    r"\bsql\b": "SQL",
    r"\bjoin\b": "SQL Joins",
    r"\ber diagram\b": "ER Diagrams",
    r"\btransaction\b": "Transactions",
    r"\bindex\b": "Database Indexing",
    # OS
    r"\bdeadlock\b": "Deadlock Prevention",
    r"\bvirtual memory\b": "Virtual Memory",
    r"\bpaging\b": "Paging",
    r"\bsemaphore": "Semaphores",
    r"\bscheduling\b": "CPU Scheduling",
    r"\btlb\b": "TLB",
    r"\boperating system\b": "Operating Systems",
    r"\bprocess\b": "Process Management",
    r"\bthread\b": "Threading",
    # DSA / Algorithms
    r"\bdata structures?\b": "Data Structures",
    r"\bdsa\b": "Data Structures and Algorithms",
    r"\balgorithms?\b": "Algorithms",
    r"\blinked list\b": "Linked Lists",
    r"\bstack\b": "Stacks",
    r"\bqueue\b": "Queues",
    r"\bgraph\b": "Graphs",
    r"\bbinary tree\b": "Binary Trees",
    r"\btree\b": "Trees",
    r"\bdynamic programming\b": "Dynamic Programming",
    r"\btime complexity\b": "Time Complexity",
    r"\bspace complexity\b": "Space Complexity",
    r"\bbig\s*o\b": "Big-O Notation",
    r"\bhash table\b": "Hash Tables",
    r"\bhash map\b": "Hash Maps",
    r"\barray\b": "Arrays",
    r"\bsorting\b": "Sorting Algorithms",
    r"\brecursion\b": "Recursion",
    r"\bbinary search\b": "Binary Search",
    r"\bdepth[- ]first\b": "Depth-First Search",
    r"\bbreadth[- ]first\b": "Breadth-First Search",
    r"\bdfs\b": "Depth-First Search",
    r"\bbfs\b": "Breadth-First Search",
    r"\bheap\b": "Heaps",
    r"\btrie\b": "Tries",
    r"\bdivide and conquer\b": "Divide and Conquer",
    r"\bgreedy\b": "Greedy Algorithms",
    r"\bbacktracking\b": "Backtracking",
}


def extract_concepts_from_text(transcript: str, max_concepts: int = 8) -> List[str]:
    """Extract academic concepts using keyword patterns and capitalized phrases."""
    if not transcript or len(transcript.strip()) < 5:
        return []

    concepts: List[str] = []
    seen: set[str] = set()
    lower = transcript.lower()

    for pattern, name in CONCEPT_KEYWORD_PATTERNS.items():
        if re.search(pattern, lower) and name.lower() not in seen:
            concepts.append(name)
            seen.add(name.lower())

    cap_phrases = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b", transcript)
    freq = Counter(cap_phrases)
    skip = {"the", "this", "that", "today", "welcome", "now", "let", "there", "then"}
    for phrase, _count in freq.most_common(max_concepts):
        if len(phrase) > 3 and phrase.lower() not in seen and phrase.lower() not in skip:
            concepts.append(phrase)
            seen.add(phrase.lower())

    return concepts[:max_concepts]
