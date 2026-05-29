import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { useAgent } from "@/context/AgentContext";
import { VoiceWaveform } from "./VoiceWaveform";
import { commandLifecycleManager } from "@/services/voice/commandLifecycleManager";
import { 
  Brain, 
  Mic, 
  MicOff, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Trash2, 
  MessageSquare,
  Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AiCompanionPanel() {
  const {
    agentNotifications,
    clearAgentNotifications,
    companionExpanded,
    setCompanionExpanded
  } = useAppStore();

  const isExpanded = companionExpanded;
  const setIsExpanded = setCompanionExpanded;

  const {
    websocketStatus,
    voiceStatus,
    transcript,
    aiResponseStream,
    startListening,
    stopListening
  } = useAgent();

  const isListening = voiceStatus === "listening" || voiceStatus === "responding";
  const isProcessing = voiceStatus === "thinking" || voiceStatus === "executing";

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom when new notifications arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentNotifications, isExpanded]);

  // Automatically expand the panel when speech starts, is processing, or is streaming responses
  useEffect(() => {
    if (isListening || isProcessing || aiResponseStream) {
      setIsExpanded(true);
    }
  }, [isListening, isProcessing, aiResponseStream]);

  const toggleListening = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isListening || isProcessing) {
      commandLifecycleManager.executeStop();
    } else {
      startListening();
      setIsExpanded(true);
    }
  };

  const getAgentColorClass = (agentName?: string) => {
    if (!agentName) return "text-primary bg-primary/10";
    const name = agentName.toLowerCase();
    if (name.includes("orchestrator")) return "text-[var(--neuro-cyan)] bg-[var(--neuro-cyan)]/10";
    if (name.includes("tutor")) return "text-[var(--neuro-green)] bg-[var(--neuro-green)]/10";
    if (name.includes("quiz")) return "text-[var(--neuro-amber)] bg-[var(--neuro-amber)]/10";
    if (name.includes("lecture")) return "text-[var(--neuro-rose)] bg-[var(--neuro-rose)]/10";
    if (name.includes("summary")) return "text-[var(--neuro-purple)] bg-[var(--neuro-purple)]/10";
    if (name.includes("navigation")) return "text-primary bg-primary/10";
    return "text-muted-foreground bg-muted";
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "agent":
        return <Sparkles className="size-3 text-[var(--neuro-cyan)]" />;
      case "success":
        return <Sparkles className="size-3 text-[var(--neuro-green)]" />;
      case "warning":
        return <Sparkles className="size-3 text-[var(--neuro-rose)] animate-pulse" />;
      default:
        return <Brain className="size-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none select-none">
      
      {/* Expanded Companion HUD Card */}
      {isExpanded && (
        <div className="pointer-events-auto w-85 max-h-[440px] flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/85 backdrop-blur-lg shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/30 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative size-6 rounded-lg bg-primary/10 flex items-center justify-center neuro-glow-sm">
                <Brain className="size-3.5 text-primary" />
                {isListening && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500 animate-ping" />
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground tracking-wide">NeuroLearn Companion</h3>
                <span className="text-[9px] text-muted-foreground">Dynamic Runtime Adapters</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1">
                <span className={cn(
                  "size-1.5 rounded-full",
                  isListening ? "bg-red-500 animate-pulse" :
                  isProcessing ? "bg-[var(--neuro-amber)] animate-spin" :
                  websocketStatus === "connected" ? "bg-green-500" :
                  websocketStatus === "connecting" ? "bg-[var(--neuro-cyan)] animate-pulse" :
                  "bg-muted-foreground"
                )} />
                <span className="text-[9px] text-muted-foreground capitalize">
                  {isListening ? "Listening" : isProcessing ? "Decoding" : websocketStatus}
                </span>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Transcript / Audio Wave / Token Streaming Area */}
          {(isListening || transcript || isProcessing || aiResponseStream) && (
            <div className="border-b border-border/30 bg-muted/10 p-3 space-y-2">
              <VoiceWaveform isListening={isListening} height={36} barCount={24} />
              
              {transcript && (
                <div className="rounded-lg bg-muted/40 p-2 border border-border/25">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider flex items-center gap-1">
                    <MessageSquare className="size-2.5 text-primary" /> Live Transcript
                  </p>
                  <p className="text-xs text-foreground italic mt-0.5 font-medium line-clamp-2">
                    &quot;{transcript}&quot;
                  </p>
                </div>
              )}

              {aiResponseStream && (
                <div className="rounded-lg bg-primary/5 p-2 border border-primary/20">
                  <p className="text-[10px] text-[var(--neuro-cyan)] uppercase font-semibold tracking-wider flex items-center gap-1">
                    <Sparkles className="size-2.5" /> Companion Streaming
                  </p>
                  <p className="text-xs text-foreground mt-0.5 font-medium">
                    {aiResponseStream}
                  </p>
                </div>
              )}

              {isProcessing && !transcript && !aiResponseStream && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Cpu className="size-3.5 text-[var(--neuro-amber)] animate-spin" />
                  <span className="text-xs text-muted-foreground animate-pulse font-medium">Decoding neural pattern...</span>
                </div>
              )}
            </div>
          )}

          {/* Action Log / Notifications */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[200px] min-h-[120px] no-scrollbar">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground/60">Execution Logs</span>
              {agentNotifications.length > 0 && (
                <button 
                  onClick={clearAgentNotifications}
                  className="text-[9px] flex items-center gap-1 hover:text-[var(--neuro-rose)] text-muted-foreground/60 transition-colors"
                >
                  <Trash2 className="size-2.5" /> Clear logs
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {agentNotifications.map((notif) => (
                <div 
                  key={notif.id}
                  className="group flex gap-2 rounded-lg border border-border/20 bg-muted/10 p-2 transition-all hover:bg-muted/20"
                >
                  <div className="mt-0.5 shrink-0 flex items-center justify-center size-4 rounded bg-background/50 border border-border/30">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      {notif.agentName && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-semibold tracking-wider uppercase font-mono",
                          getAgentColorClass(notif.agentName)
                        )}>
                          {notif.agentName}
                        </span>
                      )}
                      <span className="text-[8px] text-muted-foreground/50">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-medium leading-relaxed break-words">
                      {notif.text}
                    </p>
                  </div>
                </div>
              ))}

              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Quick Guidance Prompt Helper */}
          <div className="border-t border-border/30 bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground text-center italic">
            Try: &quot;Go to AI Tutor&quot; or &quot;Start database lecture&quot;
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) / Trigger */}
      <div className="flex gap-2 items-center pointer-events-auto">
        
        {/* Toggle HUD Button */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center justify-center size-10 rounded-full border border-border/40 bg-card/90 backdrop-blur-md shadow-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
            title="Open Companion Logs"
          >
            <ChevronUp className="size-4" />
          </button>
        )}

        {/* Global Voice Record Button */}
        <button
          onClick={toggleListening}
          disabled={isProcessing}
          className={cn(
            "relative flex items-center justify-center size-12 rounded-full border transition-all duration-300 shadow-xl",
            isListening 
              ? "bg-red-500 border-red-400 text-white neuro-glow" 
              : "bg-primary border-primary/40 text-primary-foreground hover:scale-105 neuro-glow-sm"
          )}
          title={isListening ? "Stop Voice Recognition" : "Trigger Voice Command"}
        >
          {isListening ? (
            <div className="relative flex items-center justify-center">
              <MicOff className="size-5 animate-pulse" />
            </div>
          ) : isProcessing ? (
            <Cpu className="size-5 animate-spin" />
          ) : (
            <Mic className="size-5" />
          )}
        </button>
      </div>

    </div>
  );
}
