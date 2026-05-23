import json
from sqlalchemy.orm import Session
from backend.database import (
    DBUserProfile, DBLecture, DBConcept, DBQuizQuestion, 
    DBFlashcard, DBWeakTopic, DBRetentionPoint, DBMasteryPoint
)

def seed_database(db: Session):
    # Check if already seeded
    if db.query(DBUserProfile).first():
        return
        
    print("Seeding SQLite database with mock records...")
    
    # 1. Profile
    profile = DBUserProfile(
        id="demo-user",
        name="Alex Chen",
        study_streak=12,
        total_hours=47,
        concepts_mastered=38,
        exam_readiness=73,
        weekly_goal_progress=71,
        preferred_style="Analogy-based"
    )
    db.add(profile)
    
    # 2. Lectures
    lectures = [
        DBLecture(id="l1", title="Database Normalization & BCNF", subject="DBMS", duration=48, concept_count=9, flashcard_count=24, topics_json=json.dumps(["BCNF", "3NF", "Functional Dependencies", "Armstrong's Axioms"]), date="2026-05-20"),
        DBLecture(id="l2", title="Transaction Management & ACID", subject="DBMS", duration=52, concept_count=11, flashcard_count=28, topics_json=json.dumps(["ACID", "Serializability", "Concurrency Control", "Deadlock"]), date="2026-05-18"),
        DBLecture(id="l3", title="B+ Trees & Indexing Strategies", subject="DBMS", duration=44, concept_count=8, flashcard_count=19, topics_json=json.dumps(["B+ Tree", "Hash Index", "Query Optimization"]), date="2026-05-15"),
        DBLecture(id="l4", title="Process Scheduling Algorithms", subject="OS", duration=55, concept_count=12, flashcard_count=31, topics_json=json.dumps(["Round Robin", "FCFS", "Priority Scheduling", "Multilevel Queue"]), date="2026-05-13"),
        DBLecture(id="l5", title="Memory Management & Paging", subject="OS", duration=41, concept_count=7, flashcard_count=18, topics_json=json.dumps(["Paging", "Segmentation", "TLB", "Page Replacement"]), date="2026-05-10")
    ]
    for l in lectures:
        db.add(l)
        
    # 3. Concepts
    concepts = [
        DBConcept(id="c1", name="BCNF", subject="DBMS", mastery=82.0, retention=78.0, connections_json=json.dumps(["c2", "c3", "c4"]), last_reviewed="2026-05-20"),
        DBConcept(id="c2", name="3NF", subject="DBMS", mastery=75.0, retention=71.0, connections_json=json.dumps(["c1", "c3"]), last_reviewed="2026-05-18"),
        DBConcept(id="c3", name="Functional Dependencies", subject="DBMS", mastery=90.0, retention=88.0, connections_json=json.dumps(["c1", "c2", "c4"]), last_reviewed="2026-05-20"),
        DBConcept(id="c4", name="Armstrong's Axioms", subject="DBMS", mastery=68.0, retention=62.0, connections_json=json.dumps(["c3"]), last_reviewed="2026-05-16"),
        DBConcept(id="c5", name="Serializability", subject="DBMS", mastery=71.0, retention=65.0, connections_json=json.dumps(["c6", "c7"]), last_reviewed="2026-05-18"),
        DBConcept(id="c6", name="Deadlock Prevention", subject="DBMS", mastery=35.0, retention=28.0, connections_json=json.dumps(["c5", "c7"]), last_reviewed="2026-05-12"),
        DBConcept(id="c7", name="ACID Properties", subject="DBMS", mastery=88.0, retention=85.0, connections_json=json.dumps(["c5", "c6"]), last_reviewed="2026-05-19"),
        DBConcept(id="c8", name="B+ Tree", subject="DBMS", mastery=79.0, retention=74.0, connections_json=json.dumps(["c9"]), last_reviewed="2026-05-15"),
        DBConcept(id="c9", name="Query Optimization", subject="DBMS", mastery=62.0, retention=55.0, connections_json=json.dumps(["c8"]), last_reviewed="2026-05-14"),
        DBConcept(id="c10", name="Round Robin", subject="OS", mastery=85.0, retention=82.0, connections_json=json.dumps(["c11", "c12"]), last_reviewed="2026-05-13"),
        DBConcept(id="c11", name="Priority Scheduling", subject="OS", mastery=77.0, retention=72.0, connections_json=json.dumps(["c10", "c12"]), last_reviewed="2026-05-13"),
        DBConcept(id="c12", name="Paging", subject="OS", mastery=80.0, retention=76.0, connections_json=json.dumps(["c13"]), last_reviewed="2026-05-10"),
        DBConcept(id="c13", name="TLB", subject="OS", mastery=55.0, retention=48.0, connections_json=json.dumps(["c12"]), last_reviewed="2026-05-09"),
        DBConcept(id="c14", name="Page Replacement", subject="OS", mastery=66.0, retention=58.0, connections_json=json.dumps(["c12", "c13"]), last_reviewed="2026-05-10")
    ]
    for c in concepts:
        db.add(c)
        
    # 4. Weak topics
    weak_topics = [
        DBWeakTopic(name="Deadlock Prevention", subject="DBMS", score=35.0, days_until_forgetting=2, trend="declining"),
        DBWeakTopic(name="TLB", subject="OS", score=55.0, days_until_forgetting=3, trend="stable"),
        DBWeakTopic(name="Query Optimization", subject="DBMS", score=62.0, days_until_forgetting=4, trend="improving"),
        DBWeakTopic(name="Armstrong's Axioms", subject="DBMS", score=68.0, days_until_forgetting=5, trend="declining"),
        DBWeakTopic(name="Page Replacement", subject="OS", score=66.0, days_until_forgetting=6, trend="stable")
    ]
    for wt in weak_topics:
        db.add(wt)
        
    # 5. Retention points
    retention_points = [
        DBRetentionPoint(date="May 16", retention=88.0),
        DBRetentionPoint(date="May 17", retention=85.0),
        DBRetentionPoint(date="May 18", retention=79.0),
        DBRetentionPoint(date="May 19", retention=83.0),
        DBRetentionPoint(date="May 20", retention=87.0),
        DBRetentionPoint(date="May 21", retention=82.0),
        DBRetentionPoint(date="May 22", retention=80.0)
    ]
    for rp in retention_points:
        db.add(rp)
        
    # 6. Mastery points
    mastery_points = [
        DBMasteryPoint(subject="DBMS", mastery=72.0),
        DBMasteryPoint(subject="OS", mastery=73.0),
        DBMasteryPoint(subject="Networks", mastery=58.0),
        DBMasteryPoint(subject="Algorithms", mastery=81.0),
        DBMasteryPoint(subject="Compilers", mastery=45.0)
    ]
    for mp in mastery_points:
        db.add(mp)
        
    # 7. Flashcards
    flashcards = [
        DBFlashcard(id="f1", front="What is BCNF?", back="A relation is in BCNF if for every non-trivial FD X->Y, X is a superkey. Stronger than 3NF — handles all anomalies when no overlapping candidate keys exist.", topic="BCNF", subject="DBMS", due_date="2026-05-22", ease=2.5, interval=1),
        DBFlashcard(id="f2", front="State Armstrong's Axioms", back="Reflexivity: if Y⊆X, then X→Y. Augmentation: if X→Y, then XZ→YZ. Transitivity: if X→Y and Y→Z, then X→Z. These are sound and complete.", topic="Armstrong's Axioms", subject="DBMS", due_date="2026-05-22", ease=2.1, interval=2),
        DBFlashcard(id="f3", front="Deadlock Prevention vs Detection", back="Prevention: eliminate one of four Coffman conditions (mutual exclusion, hold & wait, no preemption, circular wait). Detection: allow deadlock then use RAG to detect cycle and recover.", topic="Deadlock Prevention", subject="DBMS", due_date="2026-05-22", ease=1.8, interval=1),
        DBFlashcard(id="f4", front="What is a TLB?", back="Translation Lookaside Buffer — a cache for page table entries. On a TLB hit, address translation is O(1). Miss: walk the page table. Effective Access Time = hit_rate × TLB_time + miss_rate × (TLB + memory).", topic="TLB", subject="OS", due_date="2026-05-23", ease=2.0, interval=3),
        DBFlashcard(id="f5", front="B+ Tree vs B-Tree", back="B+ Tree: all data in leaves, internal nodes only store keys, leaves linked as a list (range queries efficient). B-Tree: data at all nodes, no leaf chaining — faster point lookups but slower range scans.", topic="B+ Tree", subject="DBMS", due_date="2026-05-24", ease=2.6, interval=4)
    ]
    for fc in flashcards:
        db.add(fc)

    # 8. Quiz Questions
    quiz_questions = [
        DBQuizQuestion(id="q1", question="A relation R(A,B,C,D) has FDs: AB→C, C→D, D→A. Which normal form does R satisfy?", options_json=json.dumps(["1NF only", "2NF but not 3NF", "3NF but not BCNF", "BCNF"]), correct=2, explanation="Since D→A and D is not a superkey, R is not in BCNF. But no partial/transitive deps on primary key exist, so 3NF holds.", topic="BCNF"),
        DBQuizQuestion(id="q2", question="Which scheduling algorithm may cause starvation?", options_json=json.dumps(["Round Robin", "FCFS", "Priority Scheduling (preemptive)", "Multilevel Feedback Queue"]), correct=2, explanation="Priority Scheduling can starve low-priority processes indefinitely if high-priority processes keep arriving.", topic="Priority Scheduling"),
        DBQuizQuestion(id="q3", question="In 2-Phase Locking, what is the shrinking phase?", options_json=json.dumps(["Phase where locks are acquired", "Phase where only locks are released", "Phase where transactions commit", "Phase where deadlocks are resolved"]), correct=1, explanation="In 2PL, the shrinking phase begins when the first lock is released — no new locks may be acquired after this point.", topic="Serializability")
    ]
    for qq in quiz_questions:
        db.add(qq)
        
    db.commit()
    print("Database seeding completed.")
