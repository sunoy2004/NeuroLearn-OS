import type { Lecture, Concept, QuizQuestion, Flashcard, ChatMessage, AgentStatus, LearningProfile, RetentionPoint, MasteryPoint, WeakTopic } from "@/types";

export const mockProfile: LearningProfile = {
  name: "Alex Chen",
  studyStreak: 12,
  totalHours: 47,
  conceptsMastered: 38,
  examReadiness: 73,
  weeklyGoalProgress: 71,
  preferredStyle: "Analogy-based",
};

export const mockLectures: Lecture[] = [
  { id: "l1", title: "Database Normalization & BCNF", subject: "DBMS", duration: 48, conceptCount: 9, flashcardCount: 24, topics: ["BCNF", "3NF", "Functional Dependencies", "Armstrong's Axioms"], date: "2026-05-20" },
  { id: "l2", title: "Transaction Management & ACID", subject: "DBMS", duration: 52, conceptCount: 11, flashcardCount: 28, topics: ["ACID", "Serializability", "Concurrency Control", "Deadlock"], date: "2026-05-18" },
  { id: "l3", title: "B+ Trees & Indexing Strategies", subject: "DBMS", duration: 44, conceptCount: 8, flashcardCount: 19, topics: ["B+ Tree", "Hash Index", "Query Optimization"], date: "2026-05-15" },
  { id: "l4", title: "Process Scheduling Algorithms", subject: "OS", duration: 55, conceptCount: 12, flashcardCount: 31, topics: ["Round Robin", "FCFS", "Priority Scheduling", "Multilevel Queue"], date: "2026-05-13" },
  { id: "l5", title: "Memory Management & Paging", subject: "OS", duration: 41, conceptCount: 7, flashcardCount: 18, topics: ["Paging", "Segmentation", "TLB", "Page Replacement"], date: "2026-05-10" },
];

export const mockConcepts: Concept[] = [
  { id: "c1", name: "BCNF", subject: "DBMS", mastery: 82, retention: 78, connections: ["c2", "c3", "c4"], lastReviewed: "2026-05-20" },
  { id: "c2", name: "3NF", subject: "DBMS", mastery: 75, retention: 71, connections: ["c1", "c3"], lastReviewed: "2026-05-18" },
  { id: "c3", name: "Functional Dependencies", subject: "DBMS", mastery: 90, retention: 88, connections: ["c1", "c2", "c4"], lastReviewed: "2026-05-20" },
  { id: "c4", name: "Armstrong's Axioms", subject: "DBMS", mastery: 68, retention: 62, connections: ["c3"], lastReviewed: "2026-05-16" },
  { id: "c5", name: "Serializability", subject: "DBMS", mastery: 71, retention: 65, connections: ["c6", "c7"], lastReviewed: "2026-05-18" },
  { id: "c6", name: "Deadlock Prevention", subject: "DBMS", mastery: 35, retention: 28, connections: ["c5", "c7"], lastReviewed: "2026-05-12" },
  { id: "c7", name: "ACID Properties", subject: "DBMS", mastery: 88, retention: 85, connections: ["c5", "c6"], lastReviewed: "2026-05-19" },
  { id: "c8", name: "B+ Tree", subject: "DBMS", mastery: 79, retention: 74, connections: ["c9"], lastReviewed: "2026-05-15" },
  { id: "c9", name: "Query Optimization", subject: "DBMS", mastery: 62, retention: 55, connections: ["c8"], lastReviewed: "2026-05-14" },
  { id: "c10", name: "Round Robin", subject: "OS", mastery: 85, retention: 82, connections: ["c11", "c12"], lastReviewed: "2026-05-13" },
  { id: "c11", name: "Priority Scheduling", subject: "OS", mastery: 77, retention: 72, connections: ["c10", "c12"], lastReviewed: "2026-05-13" },
  { id: "c12", name: "Paging", subject: "OS", mastery: 80, retention: 76, connections: ["c13"], lastReviewed: "2026-05-10" },
  { id: "c13", name: "TLB", subject: "OS", mastery: 55, retention: 48, connections: ["c12"], lastReviewed: "2026-05-09" },
  { id: "c14", name: "Page Replacement", subject: "OS", mastery: 66, retention: 58, connections: ["c12", "c13"], lastReviewed: "2026-05-10" },
];

export const mockWeakTopics: WeakTopic[] = [
  { name: "Deadlock Prevention", subject: "DBMS", score: 35, daysUntilForgetting: 2, trend: "declining" },
  { name: "TLB", subject: "OS", score: 55, daysUntilForgetting: 3, trend: "stable" },
  { name: "Query Optimization", subject: "DBMS", score: 62, daysUntilForgetting: 4, trend: "improving" },
  { name: "Armstrong's Axioms", subject: "DBMS", score: 68, daysUntilForgetting: 5, trend: "declining" },
  { name: "Page Replacement", subject: "OS", score: 66, daysUntilForgetting: 6, trend: "stable" },
];

export const mockRetentionData: RetentionPoint[] = [
  { date: "May 16", retention: 88 },
  { date: "May 17", retention: 85 },
  { date: "May 18", retention: 79 },
  { date: "May 19", retention: 83 },
  { date: "May 20", retention: 87 },
  { date: "May 21", retention: 82 },
  { date: "May 22", retention: 80 },
];

export const mockMasteryData: MasteryPoint[] = [
  { subject: "DBMS", mastery: 72 },
  { subject: "OS", mastery: 73 },
  { subject: "Networks", mastery: 58 },
  { subject: "Algorithms", mastery: 81 },
  { subject: "Compilers", mastery: 45 },
];

export const mockFlashcards: Flashcard[] = [
  { id: "f1", front: "What is BCNF?", back: "A relation is in BCNF if for every non-trivial FD X→Y, X is a superkey. Stronger than 3NF — handles all anomalies when no overlapping candidate keys exist.", topic: "BCNF", subject: "DBMS", dueDate: "2026-05-22", ease: 2.5, interval: 1 },
  { id: "f2", front: "State Armstrong's Axioms", back: "Reflexivity: if Y⊆X, then X→Y. Augmentation: if X→Y, then XZ→YZ. Transitivity: if X→Y and Y→Z, then X→Z. These are sound and complete.", topic: "Armstrong's Axioms", subject: "DBMS", dueDate: "2026-05-22", ease: 2.1, interval: 2 },
  { id: "f3", front: "Deadlock Prevention vs Detection", back: "Prevention: eliminate one of four Coffman conditions (mutual exclusion, hold & wait, no preemption, circular wait). Detection: allow deadlock then use RAG to detect cycle and recover.", topic: "Deadlock Prevention", subject: "DBMS", dueDate: "2026-05-22", ease: 1.8, interval: 1 },
  { id: "f4", front: "What is a TLB?", back: "Translation Lookaside Buffer — a cache for page table entries. On a TLB hit, address translation is O(1). Miss: walk the page table. Effective Access Time = hit_rate × TLB_time + miss_rate × (TLB + memory).", topic: "TLB", subject: "OS", dueDate: "2026-05-23", ease: 2.0, interval: 3 },
  { id: "f5", front: "B+ Tree vs B-Tree", back: "B+ Tree: all data in leaves, internal nodes only store keys, leaves linked as a list (range queries efficient). B-Tree: data at all nodes, no leaf chaining — faster point lookups but slower range scans.", topic: "B+ Tree", subject: "DBMS", dueDate: "2026-05-24", ease: 2.6, interval: 4 },
];

export const mockQuizQuestions: QuizQuestion[] = [
  { id: "q1", question: "A relation R(A,B,C,D) has FDs: AB→C, C→D, D→A. Which normal form does R satisfy?", options: ["1NF only", "2NF but not 3NF", "3NF but not BCNF", "BCNF"], correct: 2, explanation: "Since D→A and D is not a superkey, R is not in BCNF. But no partial/transitive deps on primary key exist, so 3NF holds.", topic: "BCNF" },
  { id: "q2", question: "Which scheduling algorithm may cause starvation?", options: ["Round Robin", "FCFS", "Priority Scheduling (preemptive)", "Multilevel Feedback Queue"], correct: 2, explanation: "Priority Scheduling can starve low-priority processes indefinitely if high-priority processes keep arriving.", topic: "Priority Scheduling" },
  { id: "q3", question: "In 2-Phase Locking, what is the shrinking phase?", options: ["Phase where locks are acquired", "Phase where only locks are released", "Phase where transactions commit", "Phase where deadlocks are resolved"], correct: 1, explanation: "In 2PL, the shrinking phase begins when the first lock is released — no new locks may be acquired after this point.", topic: "Serializability" },
];

export const mockAgents: AgentStatus[] = [
  { id: "a1", name: "Orchestrator", status: "active", task: "Coordinating learning pipeline" },
  { id: "a2", name: "Lecture Processor", status: "idle" },
  { id: "a3", name: "Adaptive Tutor", status: "active", task: "Ready for questions", progress: 100 },
  { id: "a4", name: "Knowledge Graph", status: "complete", task: "14 concepts indexed" },
  { id: "a5", name: "Weakness Detector", status: "active", task: "Monitoring 5 at-risk topics", progress: 78 },
  { id: "a6", name: "Flashcard Agent", status: "complete", task: "119 cards generated" },
  { id: "a7", name: "Quiz Generator", status: "idle" },
  { id: "a8", name: "Revision Planner", status: "processing", task: "Building tomorrow's schedule", progress: 45 },
];

export const mockChatMessages: ChatMessage[] = [
  { id: "sys1", role: "system", content: "Adaptive Tutor connected — Qdrant memory loaded (47 interactions)", timestamp: new Date(Date.now() - 60000).toISOString() },
  { id: "a0", role: "assistant", content: "Hello! I'm your Adaptive Tutor powered by Lyzr. I've loaded your semantic memory and detected you learn best through analogies.\n\nYou have 5 topics at risk of forgetting — want me to start with Deadlock Prevention?", timestamp: new Date(Date.now() - 55000).toISOString(), agent: "Adaptive Tutor" },
];
