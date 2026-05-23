export type Page = "dashboard" | "lecture-studio" | "tutor" | "knowledge-graph" | "revision" | "analytics" | "voice";

export interface Lecture {
  id: string;
  title: string;
  subject: string;
  duration: number;
  conceptCount: number;
  flashcardCount: number;
  topics: string[];
  date: string;
}

export interface Concept {
  id: string;
  name: string;
  subject: string;
  mastery: number;
  retention: number;
  connections: string[];
  lastReviewed: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  topic: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  topic: string;
  subject: string;
  dueDate: string;
  ease: number;
  interval: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  agent?: string;
  thinking?: boolean;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: "active" | "processing" | "complete" | "idle";
  task?: string;
  progress?: number;
}

export interface LearningProfile {
  name: string;
  studyStreak: number;
  totalHours: number;
  conceptsMastered: number;
  examReadiness: number;
  weeklyGoalProgress: number;
  preferredStyle: string;
}

export interface RetentionPoint {
  date: string;
  retention: number;
}

export interface MasteryPoint {
  subject: string;
  mastery: number;
}

export interface WeakTopic {
  name: string;
  subject: string;
  score: number;
  daysUntilForgetting: number;
  trend: "declining" | "improving" | "stable";
}

export type VoiceIntent =
  | "LECTURE_START"
  | "LECTURE_STOP"
  | "QUIZ_REQUEST"
  | "TUTORING_REQUEST"
  | "REVISION_START"
  | "ANALYTICS_QUERY"
  | "FLASHCARD_CREATE"
  | "ROADMAP_CREATE"
  | "GOAL_SET"
  | "WEAK_AREAS_QUERY"
  | "PROGRESS_QUERY"
  | "EXPLANATION_REQUEST"
  | "UNKNOWN";

export interface VoiceCommand {
  id: string;
  transcript: string;
  intent: VoiceIntent;
  confidence: number;
  entities: Record<string, string>;
  userId?: string;
  timestamp: number;
}

export interface VoiceTranscript {
  text: string;
  isFinal: boolean;
  confidence: number;
  duration?: number;
  timestamp?: number;
}

export interface VoiceActivityResult {
  detected: boolean;
  audioLevel: number;
  silenceDuration: number;
}

export interface HesitationMetrics {
  pauseBeforeAnswer: number;
  fillerWords: string[];
  repetitions: number;
  confidenceScore: number;
}

export interface QuizVoiceResult {
  questionId: string;
  spokenAnswer: string;
  evaluation: {
    accuracy: number;
    understanding: number;
    hesitation: HesitationMetrics;
    feedback: string;
  };
  responseTime: number;
}

export interface VoiceSession {
  id: string;
  isActive: boolean;
  startTime: number;
  type: "lecture" | "quiz" | "tutoring" | "general";
  context?: Record<string, unknown>;
}

export interface IntentClassificationResult {
  intent: VoiceIntent;
  confidence: number;
  entities: Record<string, string>;
  reasoning: string;
}
