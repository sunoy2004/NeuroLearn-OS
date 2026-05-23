import { create } from "zustand";
import type { Page, ChatMessage, AgentStatus } from "@/types";
import { mockChatMessages, mockAgents } from "@/data/mockData";

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
}

export const useAppStore = create<AppState>((set) => ({
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
}));
