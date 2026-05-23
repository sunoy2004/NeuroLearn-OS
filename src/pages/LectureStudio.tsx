import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Upload, Square, FileAudio, Brain, Tag, Clock, CheckCircle, Zap, BookOpen, Layers, Sparkles, Activity } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { mockLectures } from "@/data/mockData";
import { cn } from "@/lib/utils";

const transcriptLines = [
  { time: "00:00", text: "Welcome to today's lecture on database normalization...", type: "speech" },
  { time: "00:14", text: "We'll be covering functional dependencies and BCNF...", type: "speech" },
  { time: "00:31", text: "[CONCEPT DETECTED: Functional Dependencies]", type: "concept" },
  { time: "00:45", text: "A functional dependency X → Y means that X uniquely determines Y...", type: "speech" },
  { time: "01:02", text: "[CONCEPT DETECTED: Armstrong's Axioms]", type: "concept" },
  { time: "01:18", text: "Armstrong's axioms give us a complete set of inference rules...", type: "speech" },
  { time: "01:35", text: "Now, let's move to Boyce-Codd Normal Form...", type: "speech" },
  { time: "01:52", text: "[CONCEPT DETECTED: BCNF] [LINKED TO: 3NF, Functional Dependencies]", type: "concept" },
  { time: "02:10", text: "BCNF requires every determinant to be a candidate key...", type: "speech" },
];

const processingSteps = [
  { id: 1, label: "Omi Audio Ingestion", status: "complete", detail: "48m 22s captured" },
  { id: 2, label: "Whisper Transcription", status: "complete", detail: "98.3% accuracy" },
  { id: 3, label: "Semantic Chunking", status: "complete", detail: "14 segments" },
  { id: 4, label: "Topic Extraction (Lyzr)", status: "complete", detail: "9 concepts found" },
  { id: 5, label: "Qdrant Embedding", status: "active", detail: "Storing vectors..." },
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
            animation: active ? `waveform ${0.8 + (i % 3) * 0.2}s ease-in-out infinite alternate` : "none",
            animationDelay: `${i * 30}ms`,
          }}
        />
      ))}
    </div>
  );
}

function ProcessingStep({ step }: { step: typeof processingSteps[0] }) {
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
  const { isRecording, setRecording, recordingTime, setRecordingTime } = useAppStore();
  const [showTranscript, setShowTranscript] = useState(false);
  const [processingLecture, setProcessingLecture] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => setRecordingTime(recordingTime + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRecording, recordingTime, setRecordingTime]);

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function handleToggle() {
    if (isRecording) { setRecording(false); setProcessingLecture(true); }
    else { setRecording(true); setRecordingTime(0); }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Lecture Studio</h2>
          <p className="text-sm text-muted-foreground">Omi voice layer · Real-time transcription · Semantic memory</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] text-[var(--neuro-cyan)] border-[var(--neuro-cyan)]/30">Omi Connected</Badge>
          <Badge variant="outline" className="text-[10px] text-[var(--neuro-green)] border-[var(--neuro-green)]/30">Lyzr Active</Badge>
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
                    {isRecording ? "Recording in progress — Omi capturing audio" : "Press to start recording your lecture"}
                  </p>
                </div>
                <WaveformVisualizer active={isRecording} />
                {isRecording && (
                  <div className="flex items-center gap-3 w-full max-w-sm">
                    <div className="flex-1 rounded-lg border border-[var(--neuro-rose)]/30 bg-[var(--neuro-rose)]/5 px-3 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Live Transcription</p>
                      <p className="text-xs font-medium text-[var(--neuro-cyan)] mt-0.5 animate-pulse">Processing speech...</p>
                    </div>
                    <div className="flex-1 rounded-lg border border-[var(--neuro-amber)]/30 bg-[var(--neuro-amber)]/5 px-3 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Concepts Found</p>
                      <p className="text-xs font-bold text-[var(--neuro-amber)] mt-0.5">3 detected</p>
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
                  <p className="text-xs text-muted-foreground">MP3, MP4, WAV, M4A up to 2GB · Async Omi pipeline</p>
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
                    {transcriptLines.map((line, i) => (
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

          {!isRecording && !showTranscript && (
            <Button variant="outline" className="w-full gap-2" onClick={() => setShowTranscript(true)}>
              <FileAudio className="size-4" /> View Sample Transcript
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {processingLecture && (
            <Card className="border-[var(--neuro-amber)]/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="size-4 text-[var(--neuro-amber)] animate-pulse" /> Processing Pipeline
                </CardTitle>
                <Progress value={45} className="h-1.5 mt-1" />
              </CardHeader>
              <CardContent className="pt-0 divide-y divide-border/20">
                {processingSteps.map((step) => <ProcessingStep key={step.id} step={step} />)}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="size-4 text-primary" /> Lecture Library
              </CardTitle>
              <CardDescription className="text-xs">{mockLectures.length} lectures · Qdrant memory</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {mockLectures.map((lecture) => (
                <div key={lecture.id} className="p-3 rounded-lg border border-border/40 hover:border-primary/30 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer">
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
                </div>
              ))}
            </CardContent>
          </Card>

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
    </div>
  );
}
