import { create } from "zustand";
import type { Page, ChatMessage, AgentStatus, LearningProfile, Lecture, Concept, WeakTopic, RetentionPoint, MasteryPoint, VoiceCommand, Flashcard, QuizQuestion } from "@/types";
import { apiRequest } from "@/services/api";
import { agentRegistry } from "@/agents/agentRegistry";

interface ProviderConfig {
  llm_provider: string;
  voice_provider: string;
  memory_provider: string;
  orchestrator_provider: string;
}

interface AppState {
  currentPage: Page;
  setPage: (page: Page) => void;
  chatMessages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  agents: AgentStatus[];
  updateAgentStatus: (id: string, status: AgentStatus["status"], task?: string, progress?: number) => void;
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
  
  activeLectureTranscript: { time: string; text: string; type: "speech" | "concept" }[];
  addLectureTranscriptLine: (line: { time: string; text: string; type: "speech" | "concept" }) => void;
  clearLectureTranscript: () => void;
  
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
  learningGoals: { id: number; title: string; subjects: string[]; progress: number; deadline: string; roadmapReport?: string }[];

  // Agent Notifications
  agentNotifications: { id: string; text: string; type: 'info' | 'success' | 'warning' | 'agent'; agentName?: string; timestamp: number }[];
  addAgentNotification: (text: string, type?: 'info' | 'success' | 'warning' | 'agent', agentName?: string) => void;
  clearAgentNotifications: () => void;

  // Provider Config (populated from WebSocket handshake)
  providerConfig: ProviderConfig;
  setProviderConfig: (config: ProviderConfig) => void;

  companionExpanded: boolean;
  setCompanionExpanded: (expanded: boolean) => void;

  // Actions
  fetchDashboardData: () => Promise<void>;
  fetchConceptGraph: () => Promise<void>;
  fetchFlashcards: () => Promise<void>;
  fetchQuizQuestions: (topic: string, options?: { count?: number; forceRegenerate?: boolean }) => Promise<void>;
  fetchLearningGoals: () => Promise<void>;
  syncAgentsFromRegistry: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: "dashboard",
  setPage: (page) => set({ currentPage: page }),
  chatMessages: [],
  addMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  agents: agentRegistry.toAgentStatus(),
  updateAgentStatus: (id, status, task, progress) => {
    agentRegistry.setAgent(id, {
      status,
      current_task: task,
      progress: progress ?? agentRegistry.getAll().find((a) => a.agent_id === id)?.progress ?? 0,
    });
    set({ agents: agentRegistry.toAgentStatus() });
  },
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
 
  activeLectureTranscript: [],
  addLectureTranscriptLine: (line) => set((s) => ({ activeLectureTranscript: [...s.activeLectureTranscript, line] })),
  clearLectureTranscript: () => set({ activeLectureTranscript: [] }),
 
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
 
  // Seeding defaults (Cleared mock data)
  profile: { name: "Learner", studyStreak: 0, totalHours: 0, conceptsMastered: 0, examReadiness: 0, weeklyGoalProgress: 0, preferredStyle: "Interactive" },
  lectures: [],
  concepts: [],
  weakTopics: [],
  retentionData: [],
  masteryData: [],
  flashcards: [],
  quizQuestions: [],
  learningGoals: [],

  // Agent Notifications
  agentNotifications: [] as AppState["agentNotifications"],
  addAgentNotification: (text, type = "info", agentName) => set((s) => ({
    agentNotifications: [
      { id: `notif-${Date.now()}-${Math.random()}`, text, type, agentName, timestamp: Date.now() },
      ...s.agentNotifications.slice(0, 19)
    ]
  })),
  clearAgentNotifications: () => set({ agentNotifications: [] }),

  // Provider Config
  providerConfig: { llm_provider: "", voice_provider: "", memory_provider: "", orchestrator_provider: "" },
  setProviderConfig: (config) => set({ providerConfig: config }),

  companionExpanded: false,
  setCompanionExpanded: (expanded) => set({ companionExpanded: expanded }),

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
      localStorage.setItem("neurolearn_concept_graph", JSON.stringify(concepts));
    } catch (e) {
      console.warn("Failed syncing concept graph from server. Offline fallback active.", e);
      const cache = localStorage.getItem("neurolearn_concept_graph");
      if (cache) {
        set({ concepts: JSON.parse(cache) });
      }
    }
  },

  fetchFlashcards: async () => {
    try {
      const data = await apiRequest<Flashcard[]>("/api/revision/flashcards");
      set({ flashcards: data });
      if (data.length > 0) {
        localStorage.setItem("neurolearn_flashcards", JSON.stringify(data));
      } else {
        localStorage.removeItem("neurolearn_flashcards");
      }
    } catch (e) {
      console.warn("Failed fetching flashcards from server. Offline fallback active.", e);
      const cache = localStorage.getItem("neurolearn_flashcards");
      if (cache) {
        set({ flashcards: JSON.parse(cache) });
      }
    }
  },

  fetchQuizQuestions: async (topic: string, options?: { count?: number; forceRegenerate?: boolean }) => {
    try {
      const data = await apiRequest<QuizQuestion[]>("/api/quiz/generate", {
        method: "POST",
        body: JSON.stringify({
          topic,
          count: options?.count ?? 10,
          forceRegenerate: options?.forceRegenerate ?? false,
        })
      });
      set({ quizQuestions: data, quizIndex: 0, quizAnswers: {} });
      localStorage.setItem(`neurolearn_quiz_${topic}`, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed fetching quiz questions from server. Offline fallback active.", e);
      const cache = localStorage.getItem(`neurolearn_quiz_${topic}`);
      if (cache) {
        set({ quizQuestions: JSON.parse(cache), quizIndex: 0, quizAnswers: {} });
      }
    }
  },

  fetchLearningGoals: async () => {
    try {
      const data = await apiRequest<any[]>("/api/revision/goals");
      set({ learningGoals: data });
      localStorage.setItem("neurolearn_learning_goals", JSON.stringify(data));
    } catch (e) {
      console.warn("Failed fetching learning goals. Offline fallback active.", e);
      const cache = localStorage.getItem("neurolearn_learning_goals");
      if (cache) {
        set({ learningGoals: JSON.parse(cache) });
      }
    }
  },

  syncAgentsFromRegistry: () => set({ agents: agentRegistry.toAgentStatus() }),
}));
