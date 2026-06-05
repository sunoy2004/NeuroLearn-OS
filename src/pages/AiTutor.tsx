import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Brain, Send, Mic, Sparkles, Zap, History, BookOpen, Lightbulb, Bot, User, Circle, Cpu, PanelRight } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/services/api";

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
    <div className={cn("flex gap-3 mb-4 w-full", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", isUser ? "bg-primary/20" : "bg-primary/10 neuro-glow-sm")}>
        {isUser ? <User className="size-4 text-primary" /> : <Bot className="size-4 text-primary" />}
      </div>
      <div className={cn("flex flex-col min-w-0 max-w-[min(100%,42rem)]", isUser ? "items-end" : "items-start")}>
        {!isUser && message.agent && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-primary/70 uppercase tracking-widest truncate">{message.agent}</span>
            <div className="size-1.5 rounded-full bg-[var(--neuro-green)] shrink-0" />
          </div>
        )}
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-sm leading-relaxed w-full break-words",
            isUser ? "bg-primary/15 text-foreground border border-primary/20" : "bg-card border border-border/50"
          )}
        >
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
  const { agents, concepts, weakTopics, profile } = useAppStore();
  const activeAgent = agents.find((a) => a.status === "active" && a.name === "Adaptive Tutor");
  const topConcepts = [...concepts].sort((a, b) => b.retention - a.retention).slice(0, 5);
  const insights = profile.insights ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/30 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Learning Context</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4 no-scrollbar">
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <History className="size-3 shrink-0" /> Memory Context
          </p>
          <div className="space-y-2">
            {topConcepts.length > 0 ? (
              topConcepts.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-xs text-muted-foreground min-w-0">
                  <div className="size-1.5 rounded-full bg-[var(--neuro-cyan)]/60 shrink-0 mt-1.5" />
                  <span className="flex-1 leading-snug break-words">{c.name}</span>
                  <span className="text-[9px] text-muted-foreground/40 shrink-0">{Math.round(c.retention)}%</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ask about any topic — local memory builds as you study.
              </p>
            )}
          </div>
        </section>

        <section className="pt-2 border-t border-border/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <BookOpen className="size-3 shrink-0" /> Related Concepts
          </p>
          <div className="space-y-2.5">
            {concepts.length > 0 ? (
              concepts.slice(0, 5).map((concept) => (
                <div key={concept.id} className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-foreground/80 leading-snug break-words">{concept.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(concept.mastery)}%</span>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${concept.mastery}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">Concepts from your lectures appear here.</p>
            )}
          </div>
        </section>

        <section className="pt-2 border-t border-border/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Lightbulb className="size-3 shrink-0" /> Tutor Insights
          </p>
          <div className="space-y-3">
            {profile.preferredStyle && (
              <div className="rounded-lg border border-[var(--neuro-amber)]/20 bg-[var(--neuro-amber)]/5 p-3">
                <p className="text-[10px] text-[var(--neuro-amber)] font-semibold uppercase tracking-widest mb-1">Learning Style</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{profile.preferredStyle}</p>
              </div>
            )}
            {insights.slice(0, 2).map((text, i) => (
              <div key={i} className="rounded-lg border border-[var(--neuro-cyan)]/20 bg-[var(--neuro-cyan)]/5 p-3">
                <p className="text-[10px] text-primary font-semibold uppercase tracking-widest mb-1">Insight</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
            {weakTopics.slice(0, 1).map((topic) => (
              <div key={topic.name} className="rounded-lg border border-[var(--neuro-rose)]/20 bg-[var(--neuro-rose)]/5 p-3">
                <p className="text-[10px] text-[var(--neuro-rose)] font-semibold uppercase tracking-widest mb-1">Weak Area</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{topic.name} ({topic.score}% mastery)</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="shrink-0 border-t border-border/30 p-4">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="size-3.5 text-primary animate-pulse shrink-0" />
          <span className="text-xs text-primary/80 font-medium truncate">
            {activeAgent ? activeAgent.task : "Tutor Agent Ready"}
          </span>
        </div>
      </div>
    </div>
  );
}

function buildSuggestedPrompts(
  concepts: { name: string; subject: string }[],
  weakTopics: { name: string }[],
  lectures: { title: string }[]
): string[] {
  const prompts: string[] = [
    "Teach me about Agent AI from scratch.",
    "Explain dynamic programming with examples.",
    "What is the difference between stack and queue?",
  ];
  if (concepts.length > 0) prompts.push(`Explain ${concepts[0].name} in simple terms.`);
  if (weakTopics.length > 0) prompts.push(`Help me revise ${weakTopics[0].name}.`);
  if (lectures.length > 0) prompts.push(`Summarize key points from "${lectures[0].title}".`);
  return prompts.slice(0, 6);
}

export function AiTutor() {
  const { chatMessages, addMessage, fetchConceptGraph, fetchDashboardData, concepts, weakTopics, lectures } = useAppStore();
  const suggestedPrompts = buildSuggestedPrompts(concepts, weakTopics, lectures);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [tutorHealth, setTutorHealth] = useState<{ healthy: boolean; provider: string; model: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConceptGraph();
    fetchDashboardData();
    apiRequest<any>("/api/tutor/health")
      .then((h) => setTutorHealth(h))
      .catch(() => setTutorHealth({ healthy: false, provider: "offline", model: "unavailable" }));
  }, [fetchConceptGraph, fetchDashboardData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
      step = Math.min(step + 1, agentThoughts.length - 1);
      setThinkingStep(step);
    }, 500);

    try {
      const res = await apiRequest<any>("/api/tutor/chat", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      clearInterval(interval);
      setIsThinking(false);
      setThinkingStep(0);

      addMessage({
        id: res.id,
        role: "assistant",
        content: res.content,
        timestamp: res.timestamp,
        agent: res.agent,
      });
    } catch (e: unknown) {
      console.warn("Backend chat failed.", e);
      clearInterval(interval);
      setIsThinking(false);
      setThinkingStep(0);

      addMessage({
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "The tutor service is unavailable right now. Make sure the backend is running, then try again.",
        timestamp: new Date().toISOString(),
        agent: "Adaptive Tutor",
      });
    }
  }

  return (
    <div className="flex h-full min-h-[calc(100svh-3rem)] w-full overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 flex items-center justify-between gap-3 border-b border-border/50 bg-background/90 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="size-9 shrink-0 rounded-lg bg-primary/10 neuro-glow-sm flex items-center justify-center">
              <Brain className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Adaptive Tutor</p>
              <p className="truncate text-xs text-muted-foreground">
                {chatMessages.length} messages · any study topic
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "hidden gap-1 text-[10px] sm:flex",
                tutorHealth?.healthy
                  ? "text-[var(--neuro-green)] border-[var(--neuro-green)]/30"
                  : "text-[var(--neuro-rose)] border-[var(--neuro-rose)]/30"
              )}
            >
              <Circle className="size-1.5 fill-current" />
              {tutorHealth?.healthy ? `Online · ${tutorHealth.provider}` : "Connecting..."}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs xl:hidden"
              onClick={() => setShowContextDrawer(true)}
            >
              <PanelRight className="size-3.5" />
              <span className="hidden sm:inline">Context</span>
            </Button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 sm:px-6">
          {chatMessages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-2 py-10 text-center">
              <Brain className="mb-4 size-14 text-primary/30" />
              <p className="mb-2 text-base font-medium text-foreground">Start your learning session</p>
              <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
                Ask about any academic topic — Agent AI, data structures, DBMS, and more. No lecture recording required.
              </p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl">
              {chatMessages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          )}

          {isThinking && (
            <div className="mx-auto mb-4 flex w-full max-w-3xl gap-3">
              <div className="size-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-primary/70">Thinking...</div>
                <div className="space-y-1.5 rounded-xl border border-primary/20 bg-card px-4 py-3">
                  {agentThoughts.slice(0, thinkingStep + 1).map((thought, i) => (
                    <div key={i} className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      {i < thinkingStep ? (
                        <Zap className="size-3 shrink-0 text-[var(--neuro-green)]" />
                      ) : (
                        <Cpu className="size-3 shrink-0 animate-spin text-[var(--neuro-amber)]" />
                      )}
                      <span className={cn("break-words", i < thinkingStep ? "text-foreground/50 line-through" : "text-[var(--neuro-amber)]")}>
                        {thought}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {suggestedPrompts.length > 0 && chatMessages.length === 0 && (
          <div className="shrink-0 border-t border-border/30 bg-background/80 px-4 py-3 sm:px-6">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Suggested prompts</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="max-w-full rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-left text-xs text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted/50 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <footer className="shrink-0 border-t border-border/50 bg-background/90 px-4 py-3 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
                placeholder="Ask anything — e.g. Teach me about neural networks"
                className="h-10 border-border/60 bg-card pr-10 text-sm focus-visible:border-primary/50"
                disabled={isThinking}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
                aria-label="Voice input"
              >
                <Mic className="size-4" />
              </button>
            </div>
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isThinking}
              className="neuro-glow-sm size-10 shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </footer>
      </div>

      <aside className="hidden min-h-0 w-80 min-w-[20rem] shrink-0 flex-col border-l border-border/50 bg-sidebar/50 xl:flex">
        <ContextPanel />
      </aside>

      <Drawer open={showContextDrawer} onOpenChange={setShowContextDrawer}>
        <DrawerContent className="flex max-h-[85dvh] flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Learning Context</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-[50dvh] flex-1 overflow-hidden">
            <ContextPanel />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
