import type { VoiceSession, VoiceCommand, VoiceTranscript } from "@/types";

interface VoiceSessionStore {
  activeSessions: Map<string, VoiceSession>;
  commandHistory: VoiceCommand[];
  transcriptBuffer: VoiceTranscript[];
}

class VoiceSessionManager {
  private store: VoiceSessionStore = {
    activeSessions: new Map(),
    commandHistory: [],
    transcriptBuffer: [],
  };

  createSession(type: VoiceSession["type"], context?: Record<string, unknown>): VoiceSession {
    const session: VoiceSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isActive: true,
      startTime: Date.now(),
      type,
      context,
    };

    this.store.activeSessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): VoiceSession | undefined {
    return this.store.activeSessions.get(sessionId);
  }

  getActiveSession(): VoiceSession | undefined {
    for (const session of this.store.activeSessions.values()) {
      if (session.isActive) return session;
    }
    return undefined;
  }

  endSession(sessionId: string): void {
    const session = this.store.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
    }
  }

  recordCommand(command: VoiceCommand): void {
    this.store.commandHistory.push(command);
    if (this.store.commandHistory.length > 100) {
      this.store.commandHistory.shift();
    }
  }

  getCommandHistory(limit: number = 20): VoiceCommand[] {
    return this.store.commandHistory.slice(-limit);
  }

  addToTranscriptBuffer(transcript: VoiceTranscript): void {
    this.store.transcriptBuffer.push(transcript);
    if (this.store.transcriptBuffer.length > 50) {
      this.store.transcriptBuffer.shift();
    }
  }

  getTranscriptBuffer(): VoiceTranscript[] {
    return [...this.store.transcriptBuffer];
  }

  clearTranscriptBuffer(): void {
    this.store.transcriptBuffer = [];
  }

  getSessionStats(sessionId: string): {
    duration: number;
    commandCount: number;
    transcriptCount: number;
  } | null {
    const session = this.store.activeSessions.get(sessionId);
    if (!session) return null;

    const sessionCommands = this.store.commandHistory.filter(
      (cmd) => cmd.timestamp >= session.startTime
    );

    const sessionTranscripts = this.store.transcriptBuffer.filter(
      (t) => (t.timestamp || 0) >= session.startTime
    );

    return {
      duration: Date.now() - session.startTime,
      commandCount: sessionCommands.length,
      transcriptCount: sessionTranscripts.length,
    };
  }
}

export const voiceSessionManager = new VoiceSessionManager();

export function formatSessionDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function getRecentVoiceCommands(count: number = 5): Array<{
  transcript: string;
  intent: string;
  timestamp: string;
}> {
  return voiceSessionManager.getCommandHistory(count).map((cmd) => ({
    transcript: cmd.transcript,
    intent: cmd.intent,
    timestamp: new Date(cmd.timestamp).toLocaleTimeString(),
  }));
}
