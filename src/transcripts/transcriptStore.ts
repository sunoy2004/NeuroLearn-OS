import { apiRequest } from "@/services/api";

export interface TranscriptChunk {
  id: string;
  lectureId: string;
  text: string;
  timestamp: number;
  timeLabel: string;
  type: "speech" | "concept";
  speaker?: string;
}

type AddChunkOptions = {
  /** When false, chunk stays local until lecture save (avoids flooding API on upload). */
  syncBackend?: boolean;
};

const STORAGE_KEY = "neurolearn_transcript_chunks";
const SYNC_DEBOUNCE_MS = 2500;

class TranscriptStore {
  private chunks: TranscriptChunk[] = [];
  private activeLectureId: string | null = null;
  private listeners: Set<(chunks: TranscriptChunk[]) => void> = new Set();
  private pendingSyncChunk: TranscriptChunk | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing = false;
  private backendSyncEnabled = true;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.chunks = JSON.parse(raw);
    } catch {
      this.chunks = [];
    }
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.chunks));
    this.listeners.forEach((cb) => cb(this.getActiveChunks()));
  }

  /** Disable per-chunk API sync during bulk imports (e.g. video upload). */
  setBackendSyncEnabled(enabled: boolean) {
    this.backendSyncEnabled = enabled;
    if (!enabled && this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
      this.pendingSyncChunk = null;
    }
  }

  startLecture(lectureId?: string): string {
    this.activeLectureId = lectureId || `lec_${Date.now()}`;
    return this.activeLectureId;
  }

  getActiveLectureId(): string | null {
    return this.activeLectureId;
  }

  getActiveChunks(): TranscriptChunk[] {
    if (!this.activeLectureId) return [];
    return this.chunks.filter((c) => c.lectureId === this.activeLectureId);
  }

  getCompiledTranscript(lectureId?: string): string {
    const id = lectureId || this.activeLectureId;
    if (!id) return "";
    return this.chunks
      .filter((c) => c.lectureId === id && c.type === "speech")
      .map((c) => c.text)
      .join("\n");
  }

  addChunk(
    text: string,
    type: "speech" | "concept" = "speech",
    timeLabel?: string,
    lectureId?: string,
    options?: AddChunkOptions
  ): TranscriptChunk {
    const lecId = lectureId || this.activeLectureId || this.startLecture();
    const chunk: TranscriptChunk = {
      id: `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      lectureId: lecId,
      text,
      timestamp: Date.now(),
      timeLabel: timeLabel || new Date().toISOString(),
      type,
    };
    this.chunks.push(chunk);
    this.persist();

    const shouldSync = options?.syncBackend !== false && this.backendSyncEnabled;
    if (shouldSync) {
      this.scheduleBackendSync(chunk);
    }

    return chunk;
  }

  private scheduleBackendSync(chunk: TranscriptChunk) {
    this.pendingSyncChunk = chunk;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      void this.flushPendingSync();
    }, SYNC_DEBOUNCE_MS);
  }

  private async flushPendingSync() {
    if (!this.pendingSyncChunk || this.syncing) return;
    const chunk = this.pendingSyncChunk;
    this.pendingSyncChunk = null;
    this.syncing = true;
    try {
      await this.syncChunkToBackend(chunk);
    } catch {
      // Best-effort — chunks are persisted locally and saved with the lecture
    } finally {
      this.syncing = false;
      if (this.pendingSyncChunk) {
        this.scheduleBackendSync(this.pendingSyncChunk);
      }
    }
  }

  private async syncChunkToBackend(chunk: TranscriptChunk) {
    await apiRequest("/api/analytics/transcript-chunk", {
      method: "POST",
      body: JSON.stringify({
        lecture_id: chunk.lectureId,
        text: chunk.text,
        chunk_type: chunk.type,
        timestamp: chunk.timestamp,
      }),
    });
  }

  finalizeLecture(lectureId?: string): string {
    const id = lectureId || this.activeLectureId;
    this.activeLectureId = null;
    return this.getCompiledTranscript(id || undefined);
  }

  clearLecture(lectureId?: string) {
    const id = lectureId || this.activeLectureId;
    if (id) {
      this.chunks = this.chunks.filter((c) => c.lectureId !== id);
      this.persist();
    }
    if (this.activeLectureId === id) this.activeLectureId = null;
  }

  subscribe(cb: (chunks: TranscriptChunk[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.getActiveChunks());
    return () => this.listeners.delete(cb);
  }
}

export const transcriptStore = new TranscriptStore();
