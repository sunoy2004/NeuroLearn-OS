import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Upload, Square, FileAudio, Brain, Tag, Clock, CheckCircle, Zap, BookOpen, Layers, Sparkles, Activity } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/services/api";
import { useAgent } from "@/context/AgentContext";
import { persistentVoiceSessionManager } from "@/services/voice/sessionManager";
import { transcriptStore } from "@/transcripts/transcriptStore";
import { getSpeechLanguageHint, getSpeechRecognitionLang, getStoredSpeechLanguageCode, setStoredSpeechLanguageCode, SPEECH_LANGUAGES, SPEECH_RECOGNITION_FALLBACK } from "@/config/speechLanguages";
import { detectConceptsFromText } from "@/utils/conceptDetection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Lecture } from "@/types";
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

  const saveAndProcessLecture = async () => {
    setProcessingLecture(true);
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

      const response = await apiRequest<{
        concepts?: string[];
        summary?: string;
        notes?: string;
        flashcardCount?: number;
        quizCount?: number;
        title?: string;
      }>("/api/analytics/lectures", {
        method: "POST",
        body: JSON.stringify({
          title: "Auto-detect",
          subject: "Computer Science",
          duration: Math.ceil(duration / 60) || 1,
          transcript: finalTranscript,
          lecture_id: lectureId,
          language: getSpeechLanguageHint(),
        })
      });

      transcriptStore.finalizeLecture(lectureId || undefined);

      const conceptCount = response.concepts?.length ?? 0;
      steps[3].status = "complete";
      steps[3].detail = `${conceptCount} concepts found`;
      steps[4].status = "active";
      steps[4].detail = "Embedding to Qdrant...";
      setPipelineSteps([...steps]);
      setPipelineProgress(60);

      await fetchDashboardData();

      steps[4].status = "complete";
      steps[4].detail = "Memory stored";
      steps[5].status = "active";
      steps[5].detail = "Updating graph...";
      setPipelineSteps([...steps]);
      setPipelineProgress(75);

      await fetchConceptGraph();

      steps[5].status = "complete";
      steps[5].detail = "Graph updated";
      steps[6].status = "complete";
      steps[6].detail = `${response.flashcardCount ?? 0} flashcards`;
      steps[7].status = "complete";
      steps[7].detail = `${response.quizCount ?? 0} quiz questions`;
      setPipelineSteps([...steps]);
      setPipelineProgress(100);

      await fetchFlashcards();

      if (response.summary || response.notes) {
        setLastProcessedSummary({
          summary: response.summary || "",
          notes: response.notes || "",
          concepts: response.concepts || [],
        });
      }

      useAppStore.getState().addAgentNotification(
        `Lecture processed — ${conceptCount} concepts, ${response.flashcardCount ?? 0} flashcards generated.`,
        "success",
        "Lecture Agent"
      );

      setTimeout(() => {
        setProcessingLecture(false);
        setShowTranscript(true);
      }, 1200);

    } catch (err) {
      console.error("Failed saving/processing lecture:", err);
      setProcessingLecture(false);
      useAppStore.getState().addAgentNotification(
        err instanceof Error ? err.message : "Lecture processing failed. Ensure you spoke during recording.",
        "warning",
        "Lecture Agent"
      );
    }
  };

  const linesToRender = activeLectureTranscript;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Lecture Studio</h2>
          <p className="text-sm text-muted-foreground">Voice capture · Real-time transcription · Semantic memory</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={speechLanguage}
            onValueChange={(v) => {
              setSpeechLanguage(v);
              setStoredSpeechLanguageCode(v);
            }}
            disabled={isRecording}
          >
            <SelectTrigger className="w-[200px] h-8 text-xs">
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
        </div>
      </div>

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

          <Card className="border-border/50 border-dashed hover:border-primary/40 transition-colors cursor-pointer group">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Upload className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Upload Audio or Video</p>
                  <p className="text-xs text-muted-foreground">MP3, MP4, WAV, M4A up to 2GB · Async pipeline</p>
                </div>
                <Button variant="outline" size="sm" className="ml-auto">Browse Files</Button>
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
                    <p className="text-xs font-medium leading-tight">{lecture.title}</p>
                    <Badge variant="outline" className="text-[9px] shrink-0">{lecture.subject}</Badge>
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
                <p className="text-xs text-foreground/80 line-clamp-4">{lastProcessedSummary.summary}</p>
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

      <Dialog open={!!selectedLecture} onOpenChange={(open) => !open && setSelectedLecture(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedLecture?.title}</DialogTitle>
            <DialogDescription>
              {selectedLecture?.subject} · {selectedLecture?.duration}m · {selectedLecture?.conceptCount} concepts
            </DialogDescription>
          </DialogHeader>
          {selectedLecture && (
            <ScrollArea className="flex-1 max-h-[60vh] pr-4">
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
                    <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                      {selectedLecture.summary}
                    </p>
                  </div>
                )}
                {selectedLecture.notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--neuro-green)] mb-2">Study Notes</h4>
                    <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                      {selectedLecture.notes}
                    </div>
                  </div>
                )}
                {!selectedLecture.summary && !selectedLecture.notes && (
                  <p className="text-sm text-muted-foreground">
                    No summary available yet. Record a lecture and stop recording to generate notes.
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
