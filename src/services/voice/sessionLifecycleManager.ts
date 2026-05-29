export type SessionState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "RESPONDING"
  | "EXECUTING"
  | "STOPPING"
  | "STOPPED"
  | "ERROR";

const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  IDLE: ["LISTENING", "THINKING", "EXECUTING", "STOPPING", "ERROR"],
  LISTENING: ["THINKING", "STOPPING", "IDLE", "ERROR"],
  THINKING: ["RESPONDING", "IDLE", "STOPPING", "ERROR"],
  RESPONDING: ["EXECUTING", "LISTENING", "IDLE", "STOPPING", "ERROR"],
  EXECUTING: ["IDLE", "LISTENING", "STOPPING", "ERROR"],
  STOPPING: ["IDLE", "STOPPED", "ERROR"],
  STOPPED: ["IDLE", "ERROR"],
  ERROR: ["IDLE", "STOPPED"],
};

type StateListener = (state: SessionState, prev: SessionState) => void;

export class VoiceSessionLifecycleManager {
  private state: SessionState = "IDLE";
  private listeners: Set<StateListener> = new Set();

  getState(): SessionState {
    return this.state;
  }

  subscribe(cb: StateListener): () => void {
    this.listeners.add(cb);
    cb(this.state, this.state);
    return () => this.listeners.delete(cb);
  }

  canTransition(to: SessionState): boolean {
    return VALID_TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  transition(to: SessionState): boolean {
    if (!this.canTransition(to) && this.state !== to) {
      console.warn(`[SessionLifecycle] Invalid transition: ${this.state} → ${to}`);
      return false;
    }
    const prev = this.state;
    this.state = to;
    this.listeners.forEach((cb) => cb(to, prev));
    return true;
  }

  /** Soft reset — companion closed but can reopen immediately */
  resetToIdle(): void {
    this.state = "IDLE";
    this.listeners.forEach((cb) => cb("IDLE", this.state));
  }

  /** Full session reset after hard shutdown */
  fullReset(): void {
    this.state = "IDLE";
    this.listeners.forEach((cb) => cb("IDLE", "STOPPED"));
  }

  isActive(): boolean {
    return ["LISTENING", "THINKING", "RESPONDING", "EXECUTING"].includes(this.state);
  }
}

export const sessionLifecycleManager = new VoiceSessionLifecycleManager();
