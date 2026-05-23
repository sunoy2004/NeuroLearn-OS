import type { VoiceCommand, QuizVoiceResult } from "@/types";

export interface MemoryCollection<T = unknown> {
  name: string;
  description: string;
  vectorSize: number;
  schema: Record<string, { type: string; indexed?: boolean }>;
  sampleData?: T[];
}

export const memoryCollections: MemoryCollection[] = [
  {
    name: "voice_command_memory",
    description: "Stores user voice commands and interactions",
    vectorSize: 1536,
    schema: {
      transcript: { type: "text", indexed: true },
      intent: { type: "keyword", indexed: true },
      entities: { type: "object" },
      userId: { type: "keyword", indexed: true },
      timestamp: { type: "integer", indexed: true },
      confidence: { type: "float" },
      success: { type: "boolean" },
      agentExecuted: { type: "keyword" },
    },
  },
  {
    name: "lecture_memory",
    description: "Stores lecture transcripts and semantic chunks",
    vectorSize: 1536,
    schema: {
      lectureId: { type: "keyword", indexed: true },
      topic: { type: "keyword", indexed: true },
      transcript: { type: "text" },
      concepts: { type: "object" },
      timestamp: { type: "integer", indexed: true },
      duration: { type: "integer" },
      userId: { type: "keyword", indexed: true },
      flashcardsGenerated: { type: "integer" },
      summary: { type: "text" },
    },
  },
  {
    name: "quiz_performance_memory",
    description: "Stores quiz results and cognitive metrics",
    vectorSize: 1536,
    schema: {
      quizId: { type: "keyword", indexed: true },
      userId: { type: "keyword", indexed: true },
      topic: { type: "keyword", indexed: true },
      questions: { type: "object" },
      accuracy: { type: "float" },
      responseSpeed: { type: "float" },
      hesitationDuration: { type: "float" },
      confidenceLevel: { type: "float" },
      timestamp: { type: "integer", indexed: true },
      conceptUnderstanding: { type: "float" },
    },
  },
  {
    name: "tutoring_memory",
    description: "Stores tutoring sessions and explanations",
    vectorSize: 1536,
    schema: {
      tutorId: { type: "keyword", indexed: true },
      userId: { type: "keyword", indexed: true },
      topic: { type: "keyword", indexed: true },
      question: { type: "text" },
      explanation: { type: "text" },
      learningStyle: { type: "keyword" },
      timestamp: { type: "integer", indexed: true },
      effectiveness: { type: "float" },
      followUpQuestions: { type: "object" },
    },
  },
  {
    name: "cognitive_profile_memory",
    description: "Stores student cognitive profile and progress",
    vectorSize: 1536,
    schema: {
      userId: { type: "keyword", indexed: true },
      learningStyle: { type: "keyword" },
      weakTopics: { type: "object" },
      strongTopics: { type: "object" },
      masteryScores: { type: "object" },
      retentionCurve: { type: "object" },
      revisitPatterns: { type: "object" },
      confidenceTrends: { type: "object" },
      avgHesitationTime: { type: "float" },
      lastUpdated: { type: "integer", indexed: true },
    },
  },
  {
    name: "flashcard_memory",
    description: "Stores generated flashcards and review schedules",
    vectorSize: 1536,
    schema: {
      flashcardId: { type: "keyword", indexed: true },
      userId: { type: "keyword", indexed: true },
      topic: { type: "keyword", indexed: true },
      front: { type: "text" },
      back: { type: "text" },
      easeFactor: { type: "float" },
      interval: { type: "integer" },
      nextReviewDate: { type: "integer", indexed: true },
      reviewCount: { type: "integer" },
      successRate: { type: "float" },
    },
  },
];

export interface MemoryPoint {
  id: string;
  vector?: number[];
  payload: Record<string, unknown>;
  score?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

class MemoryStore {
  private collections: Map<string, MemoryPoint[]>;
  private userId: string;

  constructor(userId: string = "demo-user") {
    this.userId = userId;
    this.collections = new Map();
    this.initializeCollections();
  }

  private initializeCollections(): void {
    for (const collection of memoryCollections) {
      this.collections.set(collection.name, []);
    }

    this.seedDemoData();
  }

  private seedDemoData(): void {
    const commandMemory = this.collections.get("voice_command_memory") || [];

    const demoCommands = [
      {
        id: "demo-cmd-1",
        payload: {
          transcript: "Take a quiz on Operating Systems",
          intent: "QUIZ_REQUEST",
          userId: this.userId,
          timestamp: Date.now() - 3600000,
          success: true,
          agentExecuted: "quiz",
        },
      },
      {
        id: "demo-cmd-2",
        payload: {
          transcript: "Explain B+ trees",
          intent: "TUTORING_REQUEST",
          userId: this.userId,
          timestamp: Date.now() - 7200000,
          success: true,
          agentExecuted: "tutor",
        },
      },
      {
        id: "demo-cmd-3",
        payload: {
          transcript: "Show my weak topics",
          intent: "WEAK_AREAS_QUERY",
          userId: this.userId,
          timestamp: Date.now() - 86400000,
          success: true,
          agentExecuted: "analytics",
        },
      },
    ];

    demoCommands.forEach((cmd) => commandMemory.push(cmd));

    const cognitiveMemory = this.collections.get("cognitive_profile_memory") || [];
    cognitiveMemory.push({
      id: "cognitive-profile-1",
      payload: {
        userId: this.userId,
        learningStyle: "analogy-based",
        weakTopics: {
          Deadlocks: 35,
          "BCNF Normalization": 42,
          "Query Optimization": 48,
        },
        strongTopics: {
          "ACID Properties": 89,
          "B+ Tree Indexing": 85,
          SQL: 78,
        },
        masteryScores: {
          DBMS: 67,
          OS: 72,
          "Data Structures": 81,
        },
        avgHesitationTime: 1.2,
        lastUpdated: Date.now(),
      },
    });

    const quizMemory = this.collections.get("quiz_performance_memory") || [];
    quizMemory.push({
      id: "quiz-perf-1",
      payload: {
        quizId: "quiz-os-1",
        userId: this.userId,
        topic: "Operating Systems",
        accuracy: 0.75,
        responseSpeed: 4.2,
        hesitationDuration: 1.5,
        confidenceLevel: 0.68,
        timestamp: Date.now() - 3600000,
        conceptUnderstanding: 0.72,
      },
    });
  }

  async store(collectionName: string, point: MemoryPoint): Promise<void> {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }
    collection.push(point);
  }

  async search(
    collectionName: string,
    query: {
      filter?: Record<string, unknown>;
      limit?: number;
      orderBy?: { key: string; direction: "asc" | "desc" };
    }
  ): Promise<SearchResult[]> {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      return [];
    }

    let results = [...collection];

    if (query.filter) {
      results = results.filter((point) => {
        for (const [key, value] of Object.entries(query.filter || {})) {
          if (point.payload[key] !== value) return false;
        }
        return true;
      });
    }

    if (query.orderBy) {
      results.sort((a, b) => {
        const aVal = a.payload[query.orderBy!.key];
        const bVal = b.payload[query.orderBy!.key];
        const comparison = (aVal as number) - (bVal as number);
        return query.orderBy!.direction === "desc" ? -comparison : comparison;
      });
    }

    const limit = query.limit || 10;
    return results.slice(0, limit).map((point) => ({
      id: point.id,
      score: 1.0,
      payload: point.payload,
    }));
  }

  async retrieve(collectionName: string, id: string): Promise<MemoryPoint | null> {
    const collection = this.collections.get(collectionName);
    if (!collection) return null;

    return collection.find((point) => point.id === id) || null;
  }

  async update(
    collectionName: string,
    id: string,
    updates: Record<string, unknown>
  ): Promise<void> {
    const collection = this.collections.get(collectionName);
    if (!collection) return;

    const point = collection.find((p) => p.id === id);
    if (point) {
      point.payload = { ...point.payload, ...updates };
    }
  }

  getCollectionStats(collectionName: string): { count: number; lastUpdated: number } | null {
    const collection = this.collections.get(collectionName);
    if (!collection) return null;

    const timestamps = collection
      .map((p) => p.payload.timestamp || p.payload.lastUpdated)
      .filter((t): t is number => typeof t === "number");

    return {
      count: collection.length,
      lastUpdated: timestamps.length > 0 ? Math.max(...timestamps) : Date.now(),
    };
  }
}

export const memoryStore = new MemoryStore();

export async function storeVoiceCommand(
  command: VoiceCommand,
  agentExecuted: string,
  success: boolean
): Promise<void> {
  await memoryStore.store("voice_command_memory", {
    id: command.id,
    payload: {
      transcript: command.transcript,
      intent: command.intent,
      entities: command.entities,
      userId: command.userId || "demo-user",
      timestamp: command.timestamp,
      confidence: command.confidence,
      success,
      agentExecuted,
    },
  });
}

export async function getRecentCommands(limit: number = 10): Promise<SearchResult[]> {
  return memoryStore.search("voice_command_memory", {
    filter: { userId: "demo-user" },
    limit,
    orderBy: { key: "timestamp", direction: "desc" },
  });
}

export async function storeQuizResult(result: QuizVoiceResult): Promise<void> {
  await memoryStore.store("quiz_performance_memory", {
    id: `quiz-result-${Date.now()}`,
    payload: {
      quizId: result.questionId,
      userId: "demo-user",
      ...result.evaluation,
      timestamp: Date.now(),
    },
  });
}

export async function getCognitiveProfile(): Promise<SearchResult | null> {
  const results = await memoryStore.search("cognitive_profile_memory", {
    filter: { userId: "demo-user" },
    limit: 1,
  });

  return results[0] || null;
}

export async function updateCognitiveProfile(
  updates: Record<string, unknown>
): Promise<void> {
  const profile = await getCognitiveProfile();
  if (profile) {
    await memoryStore.update("cognitive_profile_memory", profile.id, updates);
  }
}
