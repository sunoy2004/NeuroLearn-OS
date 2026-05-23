import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Bot, User, Zap, Activity, Brain, Cpu } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { masterOrchestrator } from "@/services/agents/orchestrator";
import { storeVoiceCommand, getCognitiveProfile } from "@/services/memory/qdrantClient";
import { voiceSessionManager } from "@/services/voiceSessionManager";
import type { VoiceCommand, VoiceIntent } from "@/types";
import { cn } from "@/lib/utils";
import { VoiceWaveform } from "./VoiceWaveform";
import { IntentBadge } from "./IntentBadge";

interface VoiceMessage {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  intent?: VoiceIntent;
  agent?: string;
  timestamp: number;
  isProcessing?: boolean;
}

export function VoiceInterface() {
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [_isAssistantSpeaking, _setIsAssistantSpeaking] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<VoiceIntent | null>(null);
  const [cognitiveProfile, setCognitiveProfile] = useState<Record<string, unknown> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    voiceListening: isListening,
    voiceTranscript: transcript,
    voiceProcessing: isProcessing,
    lastVoiceCommand: lastCommand,
    voiceError: error,
    setVoiceListening,
  } = useAppStore();

  const startListening = () => setVoiceListening(true);
  const stopListening = () => setVoiceListening(false);
  const simulatedMode = false;

  useEffect(() => {
    async function loadProfile() {
      const profile = await getCognitiveProfile();
      if (profile) {
        setCognitiveProfile(profile.payload);
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (lastCommand && lastCommand.intent !== "UNKNOWN") {
      handleVoiceCommand(lastCommand);
    } else if (lastCommand && lastCommand.intent === "UNKNOWN") {
      addSystemMessage("I didn't understand that command. Could you rephrase it?");
    }
  }, [lastCommand]);

  const addSystemMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        type: "system",
        content,
        timestamp: Date.now(),
      },
    ]);
  };

  const handleVoiceCommand = async (command: VoiceCommand) => {
    setCurrentIntent(command.intent);

    setMessages((prev) => [
      ...prev,
      {
        id: command.id,
        type: "user",
        content: command.transcript,
        intent: command.intent,
        timestamp: command.timestamp,
      },
    ]);

    setMessages((prev) => [
      ...prev,
      {
        id: `processing-${Date.now()}`,
        type: "assistant",
        content: `Processing your ${command.intent.replace("_", " ").toLowerCase()} request...`,
        isProcessing: true,
        timestamp: Date.now(),
      },
    ]);

    try {
      const response = await masterOrchestrator.routeCommand(command);

      setMessages((prev) => prev.filter((m) => !m.isProcessing));

      if (response.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `resp-${Date.now()}`,
            type: "assistant",
            content: response.message,
            agent: command.intent.includes("QUIZ")
              ? "Quiz Intelligence"
              : command.intent.includes("LECTURE")
              ? "Lecture Workflow"
              : command.intent.includes("ANALYTICS")
              ? "Analytics"
              : "Adaptive Tutor",
            timestamp: Date.now(),
          },
        ]);

        await storeVoiceCommand(command, response.nextAction || command.intent, true);
      } else {
        addSystemMessage(response.message);
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !m.isProcessing));
      addSystemMessage(
        `Error processing command: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    setCurrentIntent(null);
  };

  const handleTextSubmit = async (text: string) => {
    const command: VoiceCommand = {
      id: `text-${Date.now()}`,
      transcript: text,
      intent: "TUTORING_REQUEST",
      confidence: 1.0,
      entities: {},
      timestamp: Date.now(),
    };

    const { classifyIntent } = await import("@/services/voiceIntentClassifier");
    const classification = classifyIntent(text);
    command.intent = classification.intent;
    command.entities = classification.entities;
    command.confidence = classification.confidence;

    handleVoiceCommand(command);
  };

  const quickActions = [
    { label: "Start Quiz", text: "Take a quiz on DBMS", intent: "QUIZ_REQUEST" as VoiceIntent },
    {
      label: "Show Weak Areas",
      text: "What are my weak topics?",
      intent: "WEAK_AREAS_QUERY" as VoiceIntent,
    },
    {
      label: "Start Recording",
      text: "Start recording my lecture",
      intent: "LECTURE_START" as VoiceIntent,
    },
    { label: "Check Progress", text: "Show my progress", intent: "ANALYTICS_QUERY" as VoiceIntent },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b border-border/50 p-4 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Brain className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Voice-Controlled Learning</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Activity className="size-3" />
                {simulatedMode ? "Simulated mode (text input)" : "Voice capture active"}
                {currentIntent && (
                  <>
                    <span className="text-muted-foreground/30">|</span>
                    <IntentBadge intent={currentIntent} />
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isListening && (
              <Badge variant="outline" className="gap-1.5 text-green-600 border-green-600/30">
                <div className="size-2 rounded-full bg-green-600 animate-pulse" />
                Listening
              </Badge>
            )}
            {isProcessing && (
              <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-600/30">
                <Cpu className="size-3 animate-spin" />
                Processing
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <Brain className="size-16 text-primary/30" />
                <div>
                  <p className="text-lg font-medium">Ready to help you learn</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Speak or type a command to start. Try "Take a quiz", "Explain B+ trees", or
                    "Show my progress".
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-center max-w-lg">
                  {quickActions.map((action) => (
                    <Button
                      key={action.label}
                      variant="outline"
                      size="sm"
                      onClick={() => handleTextSubmit(action.text)}
                      className="text-xs"
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
          </div>

          <div className="border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm space-y-3">
            <VoiceWaveform isListening={isListening} />

            <div className="flex items-center gap-2">
              <Button
                onClick={isListening ? stopListening : startListening}
                className={cn(
                  "flex-1 h-12 transition-all",
                  isListening
                    ? "bg-red-500/10 hover:bg-red-500/20 text-red-600 border-red-500/30"
                    : "bg-primary/10 hover:bg-primary/20 text-primary border-primary/30"
                )}
                variant="outline"
              >
                {isListening ? (
                  <>
                    <MicOff className="size-4 mr-2" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="size-4 mr-2" />
                    Start Voice Command
                  </>
                )}
              </Button>
            </div>

            {transcript && (
              <div className="text-xs text-muted-foreground text-center">
                Hearing: "{transcript}"
              </div>
            )}

            {error && <div className="text-xs text-red-500 text-center">{error}</div>}

            <div className="text-xs text-muted-foreground text-center">
              Try: "Take a quiz on DBMS" • "Explain deadlocks" • "Show my weak topics"
            </div>
          </div>
        </div>

        <div className="w-80 border-l border-border/50 bg-sidebar hidden lg:block overflow-y-auto">
          <div className="p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Learning Profile</CardTitle>
                <CardDescription className="text-xs">Your cognitive patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {cognitiveProfile ? (
                  <>
                    <div>
                      <span className="text-muted-foreground">Style:</span>{" "}
                      <span className="font-medium">
                        {(cognitiveProfile.learningStyle as string) || "Analogy-based"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg Hesitation:</span>{" "}
                      <span className="font-medium">
                        {(cognitiveProfile.avgHesitationTime as number)?.toFixed(1)}s
                      </span>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Mastery Levels:</div>
                      <div className="space-y-1">
                        {Object.entries(cognitiveProfile.masteryScores as Record<string, number>)
                          .slice(0, 3)
                          .map(([subject, score]) => (
                            <div key={subject} className="flex items-center justify-between">
                              <span>{subject}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {Math.round(score)}%
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Loading profile...</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Commands</CardTitle>
                <CardDescription className="text-xs">Voice interaction history</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {voiceSessionManager
                  .getCommandHistory(5)
                  .reverse()
                  .map((cmd) => (
                    <div
                      key={cmd.id}
                      className="p-2 rounded bg-muted/30 text-xs space-y-1 border border-border/30"
                    >
                      <div className="flex items-center justify-between">
                        <IntentBadge intent={cmd.intent} />
                        <span className="text-muted-foreground text-[10px]">
                          {Math.round(cmd.confidence * 100)}%
                        </span>
                      </div>
                      <p className="truncate text-muted-foreground">
                        &quot;{cmd.transcript.slice(0, 40)}
                        {cmd.transcript.length > 40 ? "..." : ""}&quot;
                      </p>
                    </div>
                  ))}
                {voiceSessionManager.getCommandHistory().length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No commands yet
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    className="w-full text-xs justify-start"
                    onClick={() => handleTextSubmit(action.text)}
                  >
                    <Zap className="size-3 mr-2" />
                    {action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: VoiceMessage }) {
  const isUser = message.type === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "size-8 rounded-lg flex items-center justify-center shrink-0",
          isUser ? "bg-primary/20" : "bg-primary/10"
        )}
      >
        {isUser ? (
          <User className="size-4 text-primary" />
        ) : (
          <Bot className="size-4 text-primary" />
        )}
      </div>

      <div className={cn("flex-1", isUser ? "flex flex-col items-end" : "flex flex-col items-start")}>
        {message.intent && (
          <div className="mb-1">
            <IntentBadge intent={message.intent} />
          </div>
        )}

        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm max-w-[85%]",
            isUser
              ? "bg-primary/15 border border-primary/20"
              : "bg-card border border-border/50",
            message.isProcessing && "animate-pulse"
          )}
        >
          {message.isProcessing && <Cpu className="size-3 inline-block mr-2 animate-spin" />}
          {message.content}
        </div>

        {message.agent && (
          <span className="text-[10px] text-muted-foreground mt-1 px-1">{message.agent}</span>
        )}

        <span className="text-[10px] text-muted-foreground/50 mt-0.5 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
