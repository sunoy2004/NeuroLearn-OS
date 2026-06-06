import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Upload, Square, FileAudio, Brain, Tag, Clock, CheckCircle, Zap, BookOpen, Layers, Sparkles, Activity, Pencil, Trash2, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { agentRegistry } from "@/agents/agentRegistry";
import { cn } from "@/lib/utils";
import { PageHeader, PageShell } from "@/components/PageShell";
import { apiRequest, uploadFile } from "@/services/api";
import { useAgent } from "@/context/AgentContext";
import { persistentVoiceSessionManager } from "@/services/voice/sessionManager";
import { transcriptStore } from "@/transcripts/transcriptStore";
import { getSpeechLanguageHint, getSpeechRecognitionLang, getStoredSpeechLanguageCode, setStoredSpeechLanguageCode, SPEECH_LANGUAGES, SPEECH_RECOGNITION_FALLBACK } from "@/config/speechLanguages";
import { detectConceptsFromText } from "@/utils/conceptDetection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Lecture } from "@/types";
import { MarkdownContent, stripMarkdown } from "@/components/MarkdownContent";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INITIAL_PIPELINE = [
  { id: 1, label: "Audio Ingestion", status: "pending", detail: "Waiting..." },
  { id: 2, label: "Transcript Compilation", status: "pending", detail: "Waiting..." },
  { id: 3, label: "Semantic Chunking", status: "pending", detail: "Waiting..." },
  { id: 4, label: "Topic Extraction (Agent)", status: "pending", detail: "Waiting..." },
  { id: 5, label: "Memory Embedding", status: "pending", detail: "Waiting..." },
  { id: 6, label: "Knowledge Graph Update", status: "pending", detail: "Waiting..." },
  { id: 7, label: "Flashcard Generation", status: "pending", detail: "Waiting..." },
  { id: 8, label: "Quiz Generation", status: "pending", detail: "Waiting..." },
];

function WaveformVisualizer({ active }: { active: boolean }) {
  const bars = Array.from({ length: 32 }, (_, i) => i);
  return (
    <div className="flex items-center gap-0.5 h-12">
      {bars.map((i) => (
        <div
          key={i}
          className={cn("w-1 rounded-full transition-all", active ? "bg-[var(--neuro-cyan)]" : "bg-border")}
          style={{
            height: active ? `${20 + Math.sin(i * 0.8) * 18}px` : "4px",
            animationName: active ? "waveform" : "none",
            animationDuration: active ? `${0.8 + (i % 3) * 0.2}s` : undefined,
            animationTimingFunction: active ? "ease-in-out" : undefined,
            animationIterationCount: active ? "infinite" : undefined,
            animationDirection: active ? "alternate" : undefined,
            animationDelay: active ? `${i * 30}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function ProcessingStep({ step }: { step: typeof INITIAL_PIPELINE[0] & { status: string; detail: string } }) {
  const icon = step.status === "complete"
    ? <CheckCircle className="size-4 text-[var(--neuro-green)]" />
    : step.status === "active"
    ? <Activity className="size-4 text-[var(--neuro-amber)] animate-pulse" />
    : <div className="size-4 rounded-full border border-border/50" />;
  return (
    <div className="flex items-center gap-3 py-1.5">
      {icon}
      <span className={cn("text-sm flex-1", step.status === "complete" ? "text-foreground" : step.status === "active" ? "text-[var(--neuro-amber)]" : "text-muted-foreground/50")}>
        {step.label}
      </span>
      <span className="text-xs text-muted-foreground">{step.detail}</span>
    </div>
  );
}
export function LectureStudio() {
  const {
    isRecording,
    setRecording,
    recordingTime,
    setRecordingTime,
    lectures,
    fetchDashboardData,
    activeLectureTranscript,
    addLectureTranscriptLine,
    clearLectureTranscript,
    fetchConceptGraph,
    fetchFlashcards
  } = useAppStore();

  const { stopListening } = useAgent();
  const [showTranscript, setShowTranscript] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState(getStoredSpeechLanguageCode);
  const [sttError, setSttError] = useState<string | null>(null);
  const [interimText, setInterimText] = useState("");
  const [processingLecture, setProcessingLecture] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState(INITIAL_PIPELINE);
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const recordingSessionRef = useRef(0);
  const wasRecordingRef = useRef(false);
  const seenConceptsRef = useRef<Set<string>>(new Set());
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [lastProcessedSummary, setLastProcessedSummary] = useState<{ summary: string; notes: string; concepts: string[] } | null>(null);
  const [showSaveLectureModal, setShowSaveLectureModal] = useState(false);
  const [lectureNameInput, setLectureNameInput] = useState("");
  const [pendingLectureSave, setPendingLectureSave] = useState<{
    lectureId: string;
    transcript: string;
    duration: number;
    processed: Record<string, unknown>;
  } | null>(null);
  const [savingLecture, setSavingLecture] = useState(false);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [editLectureName, setEditLectureName] = useState("");
  const [renamingLecture, setRenamingLecture] = useState(false);
  const [deletingLecture, setDeletingLecture] = useState<Lecture | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_MEDIA = ".mp3,.mp4,.wav,.m4a,.webm,.mpeg,.mpga";

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setRecordingTime(useAppStore.getState().recordingTime + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRecording, setRecordingTime]);

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function addDetectedConcepts(concepts: string[]) {
    const timeStr = formatTime(useAppStore.getState().recordingTime);
    for (const concept of concepts) {
      const key = concept.toLowerCase();
      if (seenConceptsRef.current.has(key)) continue;
      seenConceptsRef.current.add(key);
      useAppStore.getState().addLectureTranscriptLine({
        time: timeStr,
        text: `[CONCEPT DETECTED: ${concept}]`,
        type: "concept",
      });
    }
  }

  function handleToggle() {
    if (isRecording) {
      setRecording(false);
    } else {
      persistentVoiceSessionManager.prepareForLectureRecording();
      stopListening();
      useAppStore.getState().clearLectureTranscript();
      seenConceptsRef.current.clear();
      setRecording(true);
      setRecordingTime(0);
      setShowTranscript(true);
    }
  }

  function stopLectureRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  }

  async function ensureMicPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      setSttError("Microphone permission denied. Allow mic access in browser settings.");
      return false;
    }
  }

  // Handle SpeechRecognition lifecycle — isRecording only (avoid re-run from unstable callbacks)
  useEffect(() => {
    if (!isRecording) {
      stopLectureRecognition();
      setInterimText("");
      return;
    }

    const sessionId = ++recordingSessionRef.current;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    setSttError(null);
    setInterimText("");
    setShowTranscript(true);
    persistentVoiceSessionManager.prepareForLectureRecording();

    const lectureId = transcriptStore.startLecture();
    persistentVoiceSessionManager.sendWebSocketMessage({
      type: "lecture_start",
      lecture_id: lectureId,
    });

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttError("Speech recognition is not supported. Please use Chrome or Edge.");
      useAppStore.getState().addAgentNotification(
        "Speech recognition unavailable — use Chrome or Edge browser.",
        "warning",
        "Lecture Agent"
      );
      setRecording(false);
      return;
    }

    let usedFallback = false;

    const startRecognition = (lang: string) => {
      if (cancelled || sessionId !== recordingSessionRef.current) return;

      stopLectureRecognition();

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang;

      rec.onresult = (e: any) => {
        if (sessionId !== recordingSessionRef.current) return;
        let newFinalText = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) {
            newFinalText += e.results[i][0].transcript;
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        if (interim) setInterimText(interim);
        if (newFinalText.trim()) {
          setInterimText("");
          const timeStr = formatTime(useAppStore.getState().recordingTime);
          useAppStore.getState().addLectureTranscriptLine({
            time: timeStr,
            text: newFinalText.trim(),
            type: "speech",
          });
          const lecId = transcriptStore.getActiveLectureId();
          transcriptStore.addChunk(newFinalText.trim(), "speech", timeStr, lecId || undefined);
          persistentVoiceSessionManager.sendWebSocketMessage({
            type: "lecture_chunk",
            text: newFinalText.trim(),
            lecture_id: lecId,
          });
          addDetectedConcepts(detectConceptsFromText(newFinalText.trim()));
        }
      };

      rec.onerror = (err: any) => {
        if (sessionId !== recordingSessionRef.current) return;
        const code = err?.error || "unknown";
        if (
          !usedFallback &&
          (code === "language-not-supported" || code === "language-unavailable") &&
          lang !== SPEECH_RECOGNITION_FALLBACK
        ) {
          usedFallback = true;
          startRecognition(SPEECH_RECOGNITION_FALLBACK);
          setSttError(`Language ${lang} not supported — using English.`);
          return;
        }
        if (code === "not-allowed") {
          setSttError("Microphone permission denied.");
          setRecording(false);
        } else if (code !== "aborted" && code !== "no-speech") {
          setSttError(`Speech error: ${code}`);
        }
      };

      rec.onend = () => {
        if (
          sessionId === recordingSessionRef.current &&
          useAppStore.getState().isRecording
        ) {
          try {
            rec.start();
          } catch {}
        }
      };

      recognitionRef.current = rec;
      try {
        rec.start();
      } catch (e) {
        console.error("Failed to start lecture STT:", e);
        setSttError("Failed to start speech recognition.");
        setRecording(false);
      }
    };

    void (async () => {
      const ok = await ensureMicPermission();
      if (!ok || cancelled || sessionId !== recordingSessionRef.current) {
        if (!ok) setRecording(false);
        return;
      }
      startTimer = setTimeout(() => {
        if (!cancelled && useAppStore.getState().isRecording) {
          startRecognition(getSpeechRecognitionLang());
        }
      }, 500);
    })();

    return () => {
      cancelled = true;
      if (startTimer) clearTimeout(startTimer);
    };
  }, [isRecording, setRecording]);

  // Handle concept detected custom event from WebSocket
  useEffect(() => {
    const handleConcept = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.concept) {
        addDetectedConcepts([data.concept]);
      }
    };
    window.addEventListener("concept_detected", handleConcept);
    return () => window.removeEventListener("concept_detected", handleConcept);
  }, []);

  // Handle pipeline trigger on recording stop
  useEffect(() => {
    if (wasRecordingRef.current && !isRecording) {
      const duration = useAppStore.getState().recordingTime;
      const hasTranscript =
        useAppStore.getState().activeLectureTranscript.some((l) => l.type === "speech") ||
        transcriptStore.getCompiledTranscript().trim().length > 0;

      if (duration >= 2 && hasTranscript) {
        saveAndProcessLecture();
      } else if (duration < 2 || !hasTranscript) {
        useAppStore.getState().addAgentNotification(
          duration < 2
            ? "Recording too short — speak for at least a few seconds before stopping."
            : "No speech captured — check mic permission and try again.",
          "warning",
          "Lecture Agent"
        );
      }
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording]);

  // Handle externally-triggered stop_lecture action (via CustomEvent)
  useEffect(() => {
    const handleStopTrigger = () => {
      if (useAppStore.getState().isRecording) {
        setRecording(false);
      }
    };
    window.addEventListener("lecture_stopped_trigger", handleStopTrigger);
    return () => window.removeEventListener("lecture_stopped_trigger", handleStopTrigger);
  }, [setRecording]);

  async function handleMediaUpload(file: File) {
    if (isRecording || processingLecture || uploadingFile) return;

    setUploadError(null);
    setUploadingFile(true);
    agentRegistry.processing("lecture", `Transcribing ${file.name}...`, 35);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadFile<{
        lectureId: string;
        transcript: string;
        durationMinutes: number;
        filename: string;
        wordCount: number;
      }>("/api/analytics/lectures/transcribe-upload", formData);

      clearLectureTranscript();
      seenConceptsRef.current.clear();
      transcriptStore.startLecture(result.lectureId);

      const sentences = result.transcript
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const chunks = sentences.length > 0 ? sentences : [result.transcript];

      chunks.forEach((text, i) => {
        const totalSecs = i * 8;
        const timeStr = `${String(Math.floor(totalSecs / 60)).padStart(2, "0")}:${String(totalSecs % 60).padStart(2, "0")}`;
        addLectureTranscriptLine({ time: timeStr, text, type: "speech" });
        transcriptStore.addChunk(text, "speech", timeStr, result.lectureId);
      });

      setRecordingTime((result.durationMinutes || 1) * 60);
      setShowTranscript(true);
      agentRegistry.complete("lecture", `Transcribed ${result.wordCount} words from ${result.filename}`);

      useAppStore.getState().addAgentNotification(
        `Transcribed "${result.filename}" — processing notes and flashcards...`,
        "success",
        "Lecture Agent"
      );

      setUploadingFile(false);
      await saveAndProcessLecture();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
      agentRegistry.idle("lecture", "Upload transcription failed");
      useAppStore.getState().addAgentNotification(msg, "warning", "Lecture Agent");
      setUploadingFile(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleBrowseFiles() {
    if (isRecording || processingLecture || uploadingFile) return;
    fileInputRef.current?.click();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleMediaUpload(file);
  }

  const saveAndProcessLecture = async () => {
    setProcessingLecture(true);
    agentRegistry.processing("notes", "Analyzing lecture transcript...", 45);
    agentRegistry.processing("lecture", "Processing lecture recording...", 50);
    setPipelineProgress(5);

    const steps = INITIAL_PIPELINE.map((s) => ({ ...s, status: "pending" as string, detail: "Waiting..." }));
    steps[0].status = "active";
    steps[0].detail = "Finalizing audio...";
    setPipelineSteps([...steps]);

    try {
      const storeTranscript = useAppStore.getState().activeLectureTranscript;
      const transcriptText = storeTranscript
        .filter(l => l.type === "speech")
        .map(l => l.text)
        .join("\n");

      const finalTranscript = transcriptText.trim() || transcriptStore.getCompiledTranscript();
      const duration = useAppStore.getState().recordingTime;

      if (!finalTranscript || finalTranscript.length < 10) {
        throw new Error("No transcript captured — speak during recording to generate content.");
      }

      steps[0].status = "complete";
      steps[0].detail = "Done";
      steps[1].status = "complete";
      steps[1].detail = `${finalTranscript.split(/\s+/).length} words`;
      steps[2].status = "active";
      steps[2].detail = "Analyzing content...";
      setPipelineSteps([...steps]);
      setPipelineProgress(25);

      const lectureId = transcriptStore.getActiveLectureId() || undefined;

      steps[2].status = "complete";
      steps[2].detail = "Structured";
      steps[3].status = "active";
      steps[3].detail = "Lyzr agents processing...";
      setPipelineSteps([...steps]);
      setPipelineProgress(40);
      agentRegistry.processing("notes", "Generating summary & study notes...", 65);
      agentRegistry.processing("flashcard", "Building flashcards...", 70);
      agentRegistry.processing("quiz", "Generating quiz questions...", 72);

      const response = await apiRequest<{
        lectureId: string;
        concepts?: string[];
        summary?: string;
        notes?: string;
        flashcardCount?: number;
        quizCount?: number;
        title?: string;
        category?: string;
        concepts_details?: unknown[];
        relationships?: unknown[];
        flashcards?: unknown[];
        quizzes?: unknown[];
        language?: string;
      }>("/api/analytics/lectures/process", {
        method: "POST",
        body: JSON.stringify({
          title: "Pending",
          subject: "Computer Science",
          duration: Math.ceil(duration / 60) || 1,
          transcript: finalTranscript,
          lecture_id: lectureId,
          language: getSpeechLanguageHint(),
        })
      });

      const conceptCount = response.concepts?.length ?? 0;
      steps[3].status = "complete";
      steps[3].detail = `${conceptCount} concepts found`;
      steps[4].status = "complete";
      steps[4].detail = "Ready to save";
      steps[5].status = "complete";
      steps[5].detail = "Awaiting lecture name";
      steps[6].status = "complete";
      steps[6].detail = `${response.flashcardCount ?? 0} flashcards prepared`;
      steps[7].status = "complete";
      steps[7].detail = `${response.quizCount ?? 0} quiz questions prepared`;
      setPipelineSteps([...steps]);
      setPipelineProgress(100);

      setPendingLectureSave({
        lectureId: response.lectureId || lectureId || `lec_${Date.now()}`,
        transcript: finalTranscript,
        duration: Math.ceil(duration / 60) || 1,
        processed: response as Record<string, unknown>,
      });
      setLectureNameInput(response.title && response.title !== "Pending" ? response.title : "");
      setShowSaveLectureModal(true);

      if (response.summary || response.notes) {
        setLastProcessedSummary({
          summary: response.summary || "",
          notes: response.notes || "",
          concepts: response.concepts || [],
        });
      }

      agentRegistry.complete("notes", "Study notes compiled");
      agentRegistry.complete("lecture", "Lecture processed");
      agentRegistry.complete("flashcard", `${response.flashcardCount ?? 0} flashcards prepared`);
      agentRegistry.complete("quiz", `${response.quizCount ?? 0} quiz questions prepared`);

      useAppStore.getState().addAgentNotification(
        `Lecture processed — name your lecture to save it to the library.`,
        "success",
        "Lecture Agent"
      );

      setTimeout(() => {
        setProcessingLecture(false);
        setShowTranscript(true);
      }, 800);

    } catch (err) {
      console.error("Failed saving/processing lecture:", err);
      agentRegistry.idle("notes", "Lecture processing failed");
      agentRegistry.idle("lecture", "Lecture processing failed");
      setProcessingLecture(false);
      useAppStore.getState().addAgentNotification(
        err instanceof Error ? err.message : "Lecture processing failed. Ensure you spoke during recording.",
        "warning",
        "Lecture Agent"
      );
    }
  };

  const confirmSaveLecture = async () => {
    if (!pendingLectureSave || !lectureNameInput.trim()) return;
    setSavingLecture(true);
    try {
      const p = pendingLectureSave.processed;
      await apiRequest("/api/analytics/lectures/save", {
        method: "POST",
        body: JSON.stringify({
          title: lectureNameInput.trim(),
          subject: "Computer Science",
          duration: pendingLectureSave.duration,
          transcript: pendingLectureSave.transcript,
          lecture_id: pendingLectureSave.lectureId,
          language: getSpeechLanguageHint(),
          category: p.category || "General",
          concepts: p.concepts || [],
          concepts_details: p.concepts_details || [],
          relationships: p.relationships || [],
          summary: p.summary || "",
          notes: p.notes || "",
          flashcards: p.flashcards || [],
          quizzes: p.quizzes || [],
        }),
      });

      transcriptStore.finalizeLecture(pendingLectureSave.lectureId);
      await fetchDashboardData();
      await fetchConceptGraph();
      await fetchFlashcards();

      useAppStore.getState().addAgentNotification(
        `Lecture "${lectureNameInput.trim()}" saved to your library.`,
        "success",
        "Lecture Agent"
      );
      setShowSaveLectureModal(false);
      setPendingLectureSave(null);
      setLectureNameInput("");
    } catch (err) {
      console.error("Failed to save lecture:", err);
      useAppStore.getState().addAgentNotification(
        err instanceof Error ? err.message : "Failed to save lecture.",
        "warning",
        "Lecture Agent"
      );
    } finally {
      setSavingLecture(false);
    }
  };

  const openEditLecture = (lecture: Lecture, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLecture(lecture);
    setEditLectureName(lecture.title);
  };

  const confirmRenameLecture = async () => {
    if (!editingLecture || !editLectureName.trim()) return;
    setRenamingLecture(true);
    try {
      await apiRequest(`/api/analytics/lectures/${editingLecture.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: editLectureName.trim() }),
      });
      await fetchDashboardData();
      if (selectedLecture?.id === editingLecture.id) {
        setSelectedLecture({ ...selectedLecture, title: editLectureName.trim() });
      }
      useAppStore.getState().addAgentNotification(
        `Lecture renamed to "${editLectureName.trim()}".`,
        "success",
        "Lecture Agent"
      );
      setEditingLecture(null);
      setEditLectureName("");
    } catch (err) {
      useAppStore.getState().addAgentNotification(
        err instanceof Error ? err.message : "Failed to rename lecture.",
        "warning",
        "Lecture Agent"
      );
    } finally {
      setRenamingLecture(false);
    }
  };

  const openDeleteLecture = (lecture: Lecture, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingLecture(lecture);
  };

  const confirmDeleteLecture = async () => {
    if (!deletingLecture) return;
    setDeletingInProgress(true);
    try {
      await apiRequest(`/api/analytics/lectures/${deletingLecture.id}`, { method: "DELETE" });
      await fetchDashboardData();
      if (selectedLecture?.id === deletingLecture.id) {
        setSelectedLecture(null);
      }
      useAppStore.getState().addAgentNotification(
        `Lecture "${deletingLecture.title}" deleted.`,
        "success",
        "Lecture Agent"
      );
      setDeletingLecture(null);
    } catch (err) {
      useAppStore.getState().addAgentNotification(
        err instanceof Error ? err.message : "Failed to delete lecture.",
        "warning",
        "Lecture Agent"
      );
    } finally {
      setDeletingInProgress(false);
    }
  };

  const cancelSaveLecture = () => {
    setShowSaveLectureModal(false);
    setPendingLectureSave(null);
    setLectureNameInput("");
    useAppStore.getState().addAgentNotification(
      "Lecture not saved — processed content was discarded.",
      "info",
      "Lecture Agent"
    );
  };

  const linesToRender = activeLectureTranscript;

  return (
    <PageShell>
      <PageHeader
        title="Lecture Studio"
        description="Voice capture · Real-time transcription · Semantic memory"
        actions={
          <>
            <Select
              value={speechLanguage}
              onValueChange={(v) => {
                setSpeechLanguage(v);
                setStoredSpeechLanguageCode(v);
              }}
              disabled={isRecording}
            >
              <SelectTrigger className="h-9 w-full text-xs sm:h-8 sm:w-[200px]">
                <SelectValue placeholder="Speech language" />
              </SelectTrigger>
              <SelectContent>
                {SPEECH_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} className="text-xs">
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-[10px] text-[var(--neuro-cyan)] border-[var(--neuro-cyan)]/30">Voice Active</Badge>
            <Badge variant="outline" className="text-[10px] text-[var(--neuro-green)] border-[var(--neuro-green)]/30">Agents Active</Badge>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className={cn("absolute inset-0 rounded-full transition-all duration-500", isRecording ? "animate-ping bg-[var(--neuro-rose)]/20 scale-150" : "")} />
                  <button
                    onClick={handleToggle}
                    className={cn(
                      "relative size-24 rounded-full flex items-center justify-center transition-all duration-300 border-2",
                      isRecording ? "bg-[var(--neuro-rose)]/15 border-[var(--neuro-rose)] text-[var(--neuro-rose)] shadow-[0_0_30px_oklch(0.65_0.22_25/0.3)]"
                        : "bg-primary/10 border-primary text-primary neuro-glow"
                    )}
                  >
                    {isRecording ? <Square className="size-8" /> : <Mic className="size-8" />}
                  </button>
                </div>
                <div className="text-center">
                  <div className={cn("text-3xl font-mono font-bold tracking-wider", isRecording ? "text-[var(--neuro-rose)]" : "text-muted-foreground")}>
                    {formatTime(recordingTime)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isRecording ? "Recording in progress — speak clearly into your microphone" : "Press to start recording your lecture"}
                  </p>
                  {sttError && (
                    <p className="text-xs text-[var(--neuro-rose)] mt-2 max-w-sm">{sttError}</p>
                  )}
                </div>
                <WaveformVisualizer active={isRecording} />
                {isRecording && (
                  <div className="flex items-center gap-3 w-full max-w-sm">
                    <div className="flex-1 rounded-lg border border-[var(--neuro-rose)]/30 bg-[var(--neuro-rose)]/5 px-3 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Live Transcription</p>
                      <p className="text-xs font-medium text-[var(--neuro-cyan)] mt-0.5">
                        {interimText || (activeLectureTranscript.filter(l => l.type === "speech").length > 0
                          ? "Capturing speech..."
                          : "Listening — speak now")}
                      </p>
                    </div>
                    <div className="flex-1 rounded-lg border border-[var(--neuro-amber)]/30 bg-[var(--neuro-amber)]/5 px-3 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Concepts Found</p>
                      <p className="text-xs font-bold text-[var(--neuro-amber)] mt-0.5">
                        {activeLectureTranscript.filter(l => l.type === 'concept').length} detected
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "border-border/50 border-dashed transition-colors group",
              uploadingFile ? "border-primary/50 bg-primary/5" : "hover:border-primary/40 cursor-pointer",
              (isRecording || processingLecture) && "opacity-60 pointer-events-none"
            )}
            onClick={handleBrowseFiles}
          >
            <CardContent className="pt-5 pb-5">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MEDIA}
                className="hidden"
                onChange={handleFileInputChange}
              />
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  {uploadingFile ? (
                    <Loader2 className="size-4 text-primary animate-spin" />
                  ) : (
                    <Upload className="size-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {uploadingFile ? "Transcribing upload..." : "Upload Audio or Video"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {uploadingFile
                      ? "Speech-to-text in progress — this may take a minute"
                      : "MP3, MP4, WAV, M4A up to 500MB · Auto-transcribe & process"}
                  </p>
                  {uploadError && (
                    <p className="text-xs text-[var(--neuro-rose)] mt-1">{uploadError}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto shrink-0"
                  disabled={uploadingFile || isRecording || processingLecture}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBrowseFiles();
                  }}
                >
                  {uploadingFile ? "Uploading..." : "Browse Files"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {(showTranscript || isRecording) && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileAudio className="size-4 text-primary" /> Live Transcript
                  {isRecording && <span className="text-[10px] text-[var(--neuro-rose)] animate-pulse font-bold uppercase tracking-widest">● Live</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[240px]">
                  <div className="space-y-2 pr-3">
                    {linesToRender.map((line, i) => (
                      <div key={i} className={cn("flex gap-3 text-sm", line.type === "concept" ? "bg-[var(--neuro-amber)]/5 border border-[var(--neuro-amber)]/20 rounded-lg px-3 py-1.5" : "")}>
                        <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0 mt-0.5">{line.time}</span>
                        <span className={cn(line.type === "concept" ? "text-[var(--neuro-amber)] font-medium text-xs" : "text-foreground/80")}>
                          {line.type === "concept" && <Tag className="size-3 inline mr-1" />}
                          {line.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {!isRecording && !showTranscript && activeLectureTranscript.length === 0 && (
            <div className="text-center py-8 border border-dashed border-border/50 rounded-xl">
              <p className="text-sm text-muted-foreground">Press record to start capturing your lecture transcript.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {processingLecture && (
            <Card className="border-[var(--neuro-amber)]/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="size-4 text-[var(--neuro-amber)] animate-pulse" /> Processing Pipeline
                </CardTitle>
                <Progress value={pipelineProgress} className="h-1.5 mt-1" />
              </CardHeader>
              <CardContent className="pt-0 divide-y divide-border/20">
                {pipelineSteps.map((step) => <ProcessingStep key={step.id} step={step} />)}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="size-4 text-primary" /> Lecture Library
              </CardTitle>
              <CardDescription className="text-xs">{lectures.length} lectures · Qdrant memory</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {lectures.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No lectures saved yet. Record and name a lecture to build your library.
                </p>
              )}
              {lectures.map((lecture) => (
                <div
                  key={lecture.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedLecture(lecture)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedLecture(lecture)}
                  className="p-3 rounded-lg border border-border/40 hover:border-primary/30 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-medium leading-tight flex-1 min-w-0">{lecture.title}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-primary"
                        onClick={(e) => openEditLecture(lecture, e)}
                        aria-label={`Rename ${lecture.title}`}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-[var(--neuro-rose)]"
                        onClick={(e) => openDeleteLecture(lecture, e)}
                        aria-label={`Delete ${lecture.title}`}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                      <Badge variant="outline" className="text-[9px]">{lecture.subject}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="size-2.5" />{lecture.duration}m</span>
                    <span className="flex items-center gap-1"><Brain className="size-2.5" />{lecture.conceptCount} concepts</span>
                    <span className="flex items-center gap-1"><Layers className="size-2.5" />{lecture.flashcardCount} cards</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {lecture.topics.slice(0, 3).map((t) => (
                      <span key={t} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                  {(lecture.summary || lecture.notes) && (
                    <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2">
                      Click to view summary & study notes
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {lastProcessedSummary && (
            <Card className="border-[var(--neuro-cyan)]/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="size-4 text-[var(--neuro-cyan)]" /> Latest Lecture Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {lastProcessedSummary.concepts.map((c) => (
                    <Badge key={c} variant="outline" className="text-[9px]">{c}</Badge>
                  ))}
                </div>
                <p className="text-xs text-foreground/80 line-clamp-4">{stripMarkdown(lastProcessedSummary.summary)}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setSelectedLecture({
                    id: "latest",
                    title: "Latest Lecture",
                    subject: "Computer Science",
                    duration: 0,
                    conceptCount: lastProcessedSummary.concepts.length,
                    flashcardCount: 0,
                    topics: lastProcessedSummary.concepts,
                    date: new Date().toISOString(),
                    summary: lastProcessedSummary.summary,
                    notes: lastProcessedSummary.notes,
                  })}
                >
                  Open Full Summary & Notes
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-[var(--neuro-green)]/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Sparkles className="size-4 text-[var(--neuro-green)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[var(--neuro-green)]">Autonomous Workflow</p>
                  <p className="text-xs text-muted-foreground mt-1">After each lecture, NeuroLearn OS automatically generates flashcards, quizzes, and updates your knowledge graph — no action required.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!editingLecture} onOpenChange={(open) => !open && setEditingLecture(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Lecture</DialogTitle>
            <DialogDescription>Update the name shown in your lecture library.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="edit-lecture-name">Lecture Name</Label>
            <Input
              id="edit-lecture-name"
              value={editLectureName}
              onChange={(e) => setEditLectureName(e.target.value)}
              placeholder="e.g. DBMS Lecture"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditingLecture(null)} disabled={renamingLecture}>
              Cancel
            </Button>
            <Button onClick={confirmRenameLecture} disabled={!editLectureName.trim() || renamingLecture}>
              {renamingLecture ? "Saving..." : "Save Name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingLecture} onOpenChange={(open) => !open && setDeletingLecture(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lecture?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &quot;{deletingLecture?.title}&quot; from your library.
              Summary, notes, and transcript chunks for this lecture will be deleted.
              Generated flashcards and quizzes are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingInProgress}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={confirmDeleteLecture}
              disabled={deletingInProgress}
            >
              {deletingInProgress ? "Deleting..." : "Delete Lecture"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSaveLectureModal} onOpenChange={(open) => !open && cancelSaveLecture()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Lecture</DialogTitle>
            <DialogDescription>
              Your lecture has been processed. Enter a name before saving to the library.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="lecture-name">Lecture Name</Label>
            <Input
              id="lecture-name"
              value={lectureNameInput}
              onChange={(e) => setLectureNameInput(e.target.value)}
              placeholder="e.g. Operating Systems Unit 1"
              autoFocus
            />
            {pendingLectureSave && (
              <p className="text-xs text-muted-foreground">
                {(pendingLectureSave.processed.concepts as string[] | undefined)?.length ?? 0} concepts ·{" "}
                {pendingLectureSave.processed.flashcardCount as number} flashcards ·{" "}
                {pendingLectureSave.processed.quizCount as number} quiz questions
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelSaveLecture} disabled={savingLecture}>
              Cancel
            </Button>
            <Button onClick={confirmSaveLecture} disabled={!lectureNameInput.trim() || savingLecture}>
              {savingLecture ? "Saving..." : "Save Lecture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLecture} onOpenChange={(open) => !open && setSelectedLecture(null)}>
        <DialogContent className="!flex sm:max-w-2xl max-h-[85vh] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border/40 px-6 py-4 text-left">
            <DialogTitle className="pr-8">{selectedLecture?.title}</DialogTitle>
            <DialogDescription>
              {selectedLecture?.subject} · {selectedLecture?.duration}m · {selectedLecture?.conceptCount} concepts
            </DialogDescription>
          </DialogHeader>
          {selectedLecture && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              <div className="space-y-4">
                {selectedLecture.topics.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--neuro-amber)] mb-2">Key Concepts</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLecture.topics.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedLecture.summary && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--neuro-cyan)] mb-2">Summary</h4>
                    <MarkdownContent content={selectedLecture.summary} />
                  </div>
                )}
                {selectedLecture.notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--neuro-green)] mb-2">Study Notes</h4>
                    <MarkdownContent content={selectedLecture.notes} />
                  </div>
                )}
                {!selectedLecture.summary && !selectedLecture.notes && (
                  <p className="text-sm text-muted-foreground">
                    No summary available yet. Record a lecture and stop recording to generate notes.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
