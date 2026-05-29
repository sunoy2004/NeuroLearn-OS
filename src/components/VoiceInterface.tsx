import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Bot, User, Zap, Activity, Brain, Cpu, MessageSquare } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useAgent } from "@/context/AgentContext";
import { getCognitiveProfile } from "@/services/memory/qdrantClient";
import { cn } from "@/lib/utils";
import { VoiceWaveform } from "./VoiceWaveform";

export function VoiceInterface() {
  const [cognitiveProfile, setCognitiveProfile] = useState<Record<string, unknown> | null>(null);
  const [textInput, setTextInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    websocketStatus,
    voiceStatus,
    transcript,
    aiResponseStream,
    messages,
    startListening,
    stopListening,
    sendTextMessage
  } = useAgent();

  const isListening = voiceStatus === "listening";
  const isProcessing = voiceStatus === "processing";

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
  }, [messages, aiResponseStream]);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    await sendTextMessage(textInput);
    setTextInput("");
  };

  const handleQuickAction = async (text: string) => {
    await sendTextMessage(text);
  };

  const quickActions = [
    { label: "Start Quiz", text: "Take a quiz on DBMS" },
    { label: "Show Weak Areas", text: "What are my weak topics?" },
    { label: "Start Recording", text: "Start recording my lecture" },
    { label: "Check Progress", text: "Show my progress" },
  ];

  // Append temporary message if streaming is active
  const displayedMessages = [...messages];
  if (aiResponseStream) {
    displayedMessages.push({
      id: "streaming-bubble",
      role: "assistant",
      content: aiResponseStream,
      timestamp: Date.now(),
      isStreaming: true
    } as any);
  }

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
                Connection: <span className="font-mono text-foreground capitalize">{websocketStatus}</span>
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
            {displayedMessages.length === 0 ? (
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
                      onClick={() => handleQuickAction(action.text)}
                      className="text-xs"
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              displayedMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
          </div>

          {/* Form and Controls */}
          <div className="border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm space-y-3">
            <VoiceWaveform isListening={isListening} />

            <div className="flex gap-2">
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

            <form onSubmit={handleTextSubmit} className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your question or action command here..."
                className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button type="submit" size="sm" className="h-10">Send</Button>
            </form>

            {transcript && (
              <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <MessageSquare className="size-3 text-primary animate-pulse" />
                Hearing: &quot;{transcript}&quot;
              </div>
            )}

            <div className="text-xs text-muted-foreground text-center">
              Try: &quot;Take a quiz on DBMS&quot; • &quot;Explain deadlocks&quot; • &quot;Show my weak topics&quot;
            </div>
          </div>
        </div>

        {/* Cognitive Profile Sidebar */}
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
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    className="w-full text-xs justify-start"
                    onClick={() => handleQuickAction(action.text)}
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

function MessageBubble({ message }: { message: any }) {
  const isUser = message.role === "user";

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
          <div className="mb-1 bg-muted px-1.5 py-0.5 rounded text-[10px] font-semibold text-muted-foreground uppercase">
            {message.intent.replace("_", " ")}
          </div>
        )}

        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm max-w-[85%]",
            isUser
              ? "bg-primary/15 border border-primary/20"
              : "bg-card border border-border/50",
            message.isStreaming && "animate-pulse border-[var(--neuro-cyan)]/30 bg-[var(--neuro-cyan)]/5"
          )}
        >
          {message.isStreaming && <Cpu className="size-3 inline-block mr-2 animate-spin text-[var(--neuro-cyan)]" />}
          {message.content}
        </div>

        {message.agentName && (
          <span className="text-[10px] text-muted-foreground mt-1 px-1">{message.agentName}</span>
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
