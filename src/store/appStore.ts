import { create } from "zustand";
import type { Page, ChatMessage, AgentStatus, LearningProfile, Lecture, Concept, WeakTopic, RetentionPoint, MasteryPoint, VoiceCommand, Flashcard, QuizQuestion } from "@/types";
import { mockChatMessages, mockAgents, mockProfile, mockLectures, mockConcepts, mockWeakTopics, mockRetentionData, mockMasteryData, mockFlashcards, mockQuizQuestions } from "@/data/mockData";
import { apiRequest } from "@/services/api";

interface AppState {
  currentPage: Page;
  setPage: (page: Page) => void;
  chatMessages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  agents: AgentStatus[];
  isRecording: boolean;
  setRecording: (v: boolean) => void;
  recordingTime: number;
  setRecordingTime: (t: number) => void;
  activeFlashcardIndex: number;
  setActiveFlashcardIndex: (i: number) => void;
  quizIndex: number;
  setQuizIndex: (i: number) => void;
  quizAnswers: Record<string, number>;
  setQuizAnswer: (id: string, answer: number) => void;
  
  // Dynamic backend synced state
  profile: LearningProfile;
  lectures: Lecture[];
  concepts: Concept[];
  weakTopics: WeakTopic[];
  retentionData: RetentionPoint[];
  masteryData: MasteryPoint[];
  
  // Global Voice Commands
  voiceListening: boolean;
  setVoiceListening: (v: boolean) => void;
  voiceProcessing: boolean;
  setVoiceProcessing: (v: boolean) => void;
  voiceTranscript: string;
  setVoiceTranscript: (t: string) => void;
  voiceError: string | null;
  setVoiceError: (e: string | null) => void;
  lastVoiceCommand: VoiceCommand | null;
  setLastVoiceCommand: (cmd: VoiceCommand | null) => void;

  flashcards: Flashcard[];
  quizQuestions: QuizQuestion[];

  // Actions
  fetchDashboardData: () => Promise<void>;
  fetchConceptGraph: () => Promise<void>;
  fetchFlashcards: () => Promise<void>;
  fetchQuizQuestions: (topic: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: "dashboard",
  setPage: (page) => set({ currentPage: page }),
  chatMessages: mockChatMessages,
  addMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  agents: mockAgents,
  isRecording: false,
  setRecording: (v) => set({ isRecording: v }),
  recordingTime: 0,
  setRecordingTime: (t) => set({ recordingTime: t }),
  activeFlashcardIndex: 0,
  setActiveFlashcardIndex: (i) => set({ activeFlashcardIndex: i }),
  quizIndex: 0,
  setQuizIndex: (i) => set({ quizIndex: i }),
  quizAnswers: {},
  setQuizAnswer: (id, answer) => set((s) => ({ quizAnswers: { ...s.quizAnswers, [id]: answer } })),

  // Global Voice Commands Initial State
  voiceListening: false,
  setVoiceListening: (v) => set({ voiceListening: v }),
  voiceProcessing: false,
  setVoiceProcessing: (v) => set({ voiceProcessing: v }),
  voiceTranscript: "",
  setVoiceTranscript: (t) => set({ voiceTranscript: t }),
  voiceError: null,
  setVoiceError: (e) => set({ voiceError: e }),
  lastVoiceCommand: null,
  setLastVoiceCommand: (cmd) => set({ lastVoiceCommand: cmd }),

  // Seeding defaults
  profile: mockProfile,
  lectures: mockLectures,
  concepts: mockConcepts,
  weakTopics: mockWeakTopics,
  retentionData: mockRetentionData,
  masteryData: mockMasteryData,
  flashcards: mockFlashcards,
  quizQuestions: mockQuizQuestions,

  fetchDashboardData: async () => {
    try {
      const data = await apiRequest("/api/analytics/dashboard");
      set({
        profile: data.profile,
        weakTopics: data.weakTopics,
        retentionData: data.retentionData,
        masteryData: data.masteryData,
        lectures: data.lectures,
      });
    } catch (e) {
      console.warn("Failed syncing dashboard from server. Offline fallback active.", e);
    }
  },

  fetchConceptGraph: async () => {
    try {
      const concepts = await apiRequest<Concept[]>("/api/graph/concepts");
      set({ concepts });
    } catch (e) {
      console.warn("Failed syncing concept graph from server. Offline fallback active.", e);
    }
  },

  fetchFlashcards: async () => {
    try {
      const data = await apiRequest<Flashcard[]>("/api/revision/flashcards");
      set({ flashcards: data });
    } catch (e) {
      console.warn("Failed fetching flashcards from server.", e);
    }
  },

  fetchQuizQuestions: async (topic: string) => {
    try {
      const data = await apiRequest<QuizQuestion[]>("/api/quiz/generate", {
        method: "POST",
        body: JSON.stringify({ topic })
      });
      set({ quizQuestions: data, quizIndex: 0, quizAnswers: {} });
    } catch (e) {
      console.warn("Failed fetching quiz questions from server.", e);
    }
  }
}));
