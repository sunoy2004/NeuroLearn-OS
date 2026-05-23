import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Brain, Send, Mic, Sparkles, Zap, History, BookOpen, Lightbulb, ChevronRight, Bot, User, Circle, Cpu, Menu } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { mockConcepts } from "@/data/mockData";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

const suggestedPrompts = [
  "Explain serializability like you explained B+ trees.",
  "Why does BCNF sometimes lose lossless joins?",
  "Connect deadlock prevention to OS resource allocation.",
  "Generate a quiz on Transaction Management.",
  "What should I revise before my DBMS exam?",
];

const agentThoughts = [
  "Retrieving semantic memory from Qdrant...",
  "Analyzing past explanations for context...",
  "Detected learning style: analogy-based...",
  "Adapting explanation to match prior context...",
  "Generating personalized response...",
];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-full px-3 py-1">
          <Circle className="size-2 fill-[var(--neuro-green)] text-[var(--neuro-green)]" />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn("size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", isUser ? "bg-primary/20" : "bg-primary/10 neuro-glow-sm")}>
        {isUser ? <User className="size-3.5 text-primary" /> : <Bot className="size-3.5 text-primary" />}
      </div>
      <div className={cn("flex-1", isUser ? "flex flex-col items-end" : "flex flex-col items-start")}>
        {!isUser && message.agent && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-primary/70 uppercase tracking-widest">{message.agent}</span>
            <div className="size-1.5 rounded-full bg-[var(--neuro-green)]" />
          </div>
        )}
        <div className={cn("rounded-xl px-4 py-3 text-sm leading-relaxed max-w-md", isUser ? "bg-primary/15 text-foreground border border-primary/20" : "bg-card border border-border/50")}>
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
        <span className="text-[10px] text-muted-foreground/50 mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

function ContextPanel() {
  const { agents } = useAppStore();
  const activeAgent = agents.find((a) => a.status === "active" && a.name === "Adaptive Tutor");

  return (
    <div className="w-full space-y-4 overflow-y-auto">
      <div className="p-4 border-b border-border/30">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <History className="size-3" /> Memory Context
        </p>
        <div className="space-y-2">
          {["B+ Tree indexing (high relevance)", "Transaction ACID properties", "BCNF normalization", "Query optimization"].map((ctx, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="size-1.5 rounded-full bg-[var(--neuro-cyan)]/60 shrink-0" />
              <span className="truncate">{ctx}</span>
              <span className="text-[9px] text-muted-foreground/40 shrink-0">{95 - i * 8}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-b border-border/30">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <BookOpen className="size-3" /> Related Concepts
        </p>
        <div className="space-y-2">
          {mockConcepts.filter((c) => c.subject === "DBMS").slice(0, 5).map((concept) => (
            <div key={concept.id} className="flex items-center justify-between">
              <span className="text-xs text-foreground/80 truncate">{concept.name}</span>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <div className="w-12 h-1 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${concept.mastery}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-6 text-right">{concept.mastery}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Lightbulb className="size-3" /> Tutor Insights
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--neuro-amber)]/20 bg-[var(--neuro-amber)]/5 p-3">
            <p className="text-[10px] text-[var(--neuro-amber)] font-semibold uppercase tracking-widest mb-1">Adaptation Active</p>
            <p className="text-xs text-muted-foreground">Analogy-based learning detected. Using filing cabinet metaphors for database concepts.</p>
          </div>
          <div className="rounded-lg border border-[var(--neuro-cyan)]/20 bg-[var(--neuro-cyan)]/5 p-3">
            <p className="text-[10px] text-primary font-semibold uppercase tracking-widest mb-1">Cross-Topic Link</p>
            <p className="text-xs text-muted-foreground">Serializability → Concurrency → OS Scheduling. Connect DBMS + OS concepts.</p>
          </div>
          <div className="rounded-lg border border-[var(--neuro-rose)]/20 bg-[var(--neuro-rose)]/5 p-3">
            <p className="text-[10px] text-[var(--neuro-rose)] font-semibold uppercase tracking-widest mb-1">Weak Area</p>
            <p className="text-xs text-muted-foreground">Deadlock prevention (35% mastery). Recommend targeted session.</p>
            <button className="text-[10px] text-[var(--neuro-rose)] mt-1 flex items-center gap-1 hover:underline">
              Start remediation <ChevronRight className="size-2.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border/30">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary animate-pulse" />
          <span className="text-xs text-primary/80 font-medium">
            {activeAgent ? activeAgent.task : "Tutor Agent Ready"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AiTutor() {
  const { chatMessages, addMessage } = useAppStore();
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 0);
    }
  }, [chatMessages, isThinking]);

  async function sendMessage(text: string) {
    if (!text.trim() || isThinking) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text, timestamp: new Date().toISOString() };
    addMessage(userMsg);
    setInput("");
    setIsThinking(true);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setThinkingStep(step);
      if (step >= agentThoughts.length) clearInterval(interval);
    }, 600);

    await new Promise((r) => setTimeout(r, 3200));
    clearInterval(interval);
    setIsThinking(false);
    setThinkingStep(0);

    const reply: ChatMessage = {
      id: `a-${Date.now()}`, role: "assistant",
      content: "I've retrieved relevant context from your Qdrant memory store and cross-referenced with your learning profile.\n\nBased on your interaction history (analogy-based learning style), here's a tailored explanation:\n\nThink of it like a filing cabinet — each drawer is a transaction, and you can't open the same drawer simultaneously from two filing clerks. That's the essence of isolation in ACID properties...",
      timestamp: new Date().toISOString(),
      agent: "Adaptive Tutor",
    };
    addMessage(reply);
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] w-full overflow-hidden flex-col lg:flex-row gap-0">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 order-2 lg:order-1">
        {/* Header */}
        <div className="border-b border-border/50 px-4 lg:px-6 py-3 flex items-center justify-between bg-background/60 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="size-8 rounded-lg bg-primary/10 neuro-glow-sm flex items-center justify-center shrink-0">
              <Brain className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Adaptive Tutor</p>
              <p className="text-xs text-muted-foreground truncate">Lyzr orchestrator · Qdrant memory · 47 interactions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] text-[var(--neuro-green)] border-[var(--neuro-green)]/30 gap-1 hidden sm:flex">
              <Circle className="size-1.5 fill-current" /> Online
            </Badge>
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setShowContextDrawer(true)}>
              <Menu className="size-4" />
            </Button>
          </div>
        </div>

        {/* Chat Messages - Fully scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0" ref={scrollRef}>
          <div className="px-4 lg:px-6 py-4 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Brain className="size-12 text-primary/30 mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Start your learning session</p>
                <p className="text-xs text-muted-foreground">Ask about concepts, generate quizzes, or get revision recommendations</p>
              </div>
            ) : (
              chatMessages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
            )}
            {isThinking && (
              <div className="flex gap-3 mb-4">
                <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="size-3.5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-primary/70 uppercase tracking-widest mb-1.5">Adaptive Tutor · Orchestrator</div>
                  <div className="bg-card border border-primary/20 rounded-xl px-4 py-3 space-y-1.5">
                    {agentThoughts.slice(0, thinkingStep + 1).map((thought, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        {i < thinkingStep
                          ? <Zap className="size-3 text-[var(--neuro-green)] shrink-0" />
                          : <Cpu className="size-3 text-[var(--neuro-amber)] animate-spin shrink-0" />}
                        <span className={i < thinkingStep ? "text-foreground/50 line-through" : "text-[var(--neuro-amber)]"}>{thought}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Suggested Prompts */}
        <div className="px-4 lg:px-6 py-2 shrink-0 border-t border-border/30">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {suggestedPrompts.map((prompt) => (
              <button key={prompt} onClick={() => sendMessage(prompt)}
                className="text-xs text-muted-foreground bg-muted/30 hover:bg-muted/50 border border-border/40 hover:border-primary/30 hover:text-foreground rounded-full px-3 py-1.5 whitespace-nowrap transition-all shrink-0">
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border/50 px-4 lg:px-6 py-3 shrink-0 bg-background/60 backdrop-blur-sm">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
                placeholder="Ask anything... context-aware tutoring powered by Lyzr + Qdrant"
                className="pr-10 bg-card border-border/60 focus-visible:border-primary/50 text-sm" disabled={isThinking} />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                <Mic className="size-4" />
              </button>
            </div>
            <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim() || isThinking} className="neuro-glow-sm shrink-0">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Context Panel - Desktop Sidebar */}
      <div className="hidden lg:flex w-72 border-l border-border/50 bg-sidebar flex-col order-1 lg:order-2">
        <ContextPanel />
      </div>

      {/* Mobile Context Drawer */}
      <Drawer open={showContextDrawer} onOpenChange={setShowContextDrawer}>
        <DrawerContent className="h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>Learning Context</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 px-4">
            <ContextPanel />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
