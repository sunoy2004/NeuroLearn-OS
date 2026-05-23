import type { VoiceCommand, QuizVoiceResult } from "@/types";
import { apiRequest } from "../api";

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

// Fallback in-memory store for offline/standalone execution
class MemoryStore {
  private collections: Map<string, MemoryPoint[]> = new Map();
  private userId: string = "demo-user";

  constructor() {
    for (const c of memoryCollections) {
      this.collections.set(c.name, []);
    }
    this.seedDemoData();
  }

  private seedDemoData(): void {
    const cognitiveMemory = this.collections.get("cognitive_profile_memory") || [];
    cognitiveMemory.push({
      id: "cognitive-profile-1",
      payload: {
        userId: this.userId,
        learningStyle: "Analogy-based",
        weakTopics: {
          "Deadlock Prevention": 35,
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
  }

  async store(collectionName: string, point: MemoryPoint): Promise<void> {
    const collection = this.collections.get(collectionName);
    if (collection) collection.push(point);
  }

  async search(collectionName: string): Promise<SearchResult[]> {
    const collection = this.collections.get(collectionName) || [];
    return collection.map((p) => ({ id: p.id, score: 1.0, payload: p.payload }));
  }

  async getLatestProfile() {
    const list = await this.search("cognitive_profile_memory");
    return list[0] || null;
  }
}

const localFallbackStore = new MemoryStore();

export async function storeVoiceCommand(
  command: VoiceCommand,
  agentExecuted: string,
  success: boolean
): Promise<void> {
  try {
    // Backend logs interactions natively on /api/voice/process,
    // so this acts as an optional audit call or local logger.
    await localFallbackStore.store("voice_command_memory", {
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
  } catch (e) {
    console.error("Local store command error", e);
  }
}

export async function getRecentCommands(_limit: number = 10): Promise<SearchResult[]> {
  try {
    const list = await localFallbackStore.search("voice_command_memory");
    return list.slice(-_limit).reverse();
  } catch {
    return [];
  }
}

export async function storeQuizResult(result: QuizVoiceResult): Promise<void> {
  try {
    await apiRequest("/api/quiz/evaluate", {
      method: "POST",
      body: JSON.stringify({
        questionId: result.questionId,
        spokenAnswer: result.spokenAnswer,
        responseTime: result.responseTime,
      }),
    });
  } catch (e) {
    console.warn("Backend evaluate quiz unavailable, saving to local fallback store.", e);
    await localFallbackStore.store("quiz_performance_memory", {
      id: `quiz-result-${Date.now()}`,
      payload: {
        quizId: result.questionId,
        userId: "demo-user",
        accuracy: result.evaluation.accuracy,
        responseSpeed: result.responseTime,
        hesitationDuration: result.evaluation.hesitation.pauseBeforeAnswer,
        confidenceLevel: result.evaluation.hesitation.confidenceScore / 100.0,
        timestamp: Date.now(),
      },
    });
  }
}

export async function getCognitiveProfile(): Promise<SearchResult | null> {
  try {
    // Pull real profile details from the database
    const profile = await apiRequest("/api/analytics/profile");
    return {
      id: "cognitive-profile-server",
      score: 1.0,
      payload: {
        userId: "demo-user",
        learningStyle: profile.preferredStyle,
        avgHesitationTime: 1.5,
        masteryScores: {
          DBMS: profile.conceptsMastered * 1.5,
          OS: profile.examReadiness * 0.9,
          "Data Structures": 81
        }
      }
    };
  } catch (e) {
    console.warn("Backend analytics query unavailable, loading from local memory client.", e);
    return localFallbackStore.getLatestProfile();
  }
}

export async function updateCognitiveProfile(
  updates: Record<string, unknown>
): Promise<void> {
  try {
    await apiRequest("/api/analytics/profile", {
      method: "POST",
      body: JSON.stringify(updates)
    });
  } catch (e) {
    console.warn("Backend update unavailable, saving to local memory client.", e);
    const profile = await localFallbackStore.getLatestProfile();
    if (profile) {
      profile.payload = { ...profile.payload, ...updates };
    }
  }
}
