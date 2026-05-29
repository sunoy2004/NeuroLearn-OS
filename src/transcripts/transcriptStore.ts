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

const STORAGE_KEY = "neurolearn_transcript_chunks";

class TranscriptStore {
  private chunks: TranscriptChunk[] = [];
  private activeLectureId: string | null = null;
  private listeners: Set<(chunks: TranscriptChunk[]) => void> = new Set();

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
    lectureId?: string
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

    // Async persist to backend (non-blocking)
    this.syncChunkToBackend(chunk).catch(() => {});

    return chunk;
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
