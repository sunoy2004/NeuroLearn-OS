import { useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Mic,
  Brain,
  Network,
  BookOpen,
  BarChart3,
  Zap,
  Circle,
  Cpu,
  Settings,
  CheckCircle,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { AiCompanionPanel } from "@/components/AiCompanionPanel";
import { useAgent } from "@/context/AgentContext";
import { registerDefaultActions, executeAction } from "@/actions/actionExecutor";
import type { Page } from "@/types";
import { cn } from "@/lib/utils";

const navItems: { id: Page; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "lecture-studio", label: "Lecture Studio", icon: Mic },
  { id: "tutor", label: "AI Tutor", icon: Brain },
  { id: "knowledge-graph", label: "Knowledge Graph", icon: Network },
  { id: "revision", label: "Revision Center", icon: BookOpen },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Agent Config", icon: Settings },
];

// Dynamic color for agent status
function getAgentStatusColor(status: string): string {
  switch (status) {
    case "active": return "var(--neuro-green)";
    case "processing": return "var(--neuro-amber)";
    case "complete": return "var(--neuro-cyan)";
    default: return "var(--neuro-muted, hsl(240 5% 35%))";
  }
}

function NeuroSidebar() {
  const { currentPage, setPage, agents, flashcards } = useAppStore();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavigate = (page: Page) => {
    setPage(page);
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  const activeAgents = agents.filter((a) => a.status === "active" || a.status === "processing").length;
  const dueFlashcards = flashcards.length;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 pb-3">
        <div className="flex items-center gap-2 px-2 pt-1">
          <div className="size-7 rounded-lg bg-primary/20 flex items-center justify-center neuro-glow-sm shrink-0">
            <Brain className="size-3.5 text-primary" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-xs font-bold text-primary tracking-wider">NEUROLEARN OS</p>
            <p className="text-[10px] text-muted-foreground">Cognitive Engine v2.0</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentPage === item.id}
                    onClick={() => handleNavigate(item.id)}
                    tooltip={item.label}
                    className={cn(
                      currentPage === item.id && "text-primary bg-primary/10"
                    )}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.badge && (
                    <SidebarMenuBadge className="bg-[var(--neuro-rose)]/20 text-[var(--neuro-rose)] text-[9px]">
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                  {item.id === "revision" && dueFlashcards > 0 && (
                    <SidebarMenuBadge className="bg-[var(--neuro-rose)]/20 text-[var(--neuro-rose)] text-[9px]">
                      {dueFlashcards}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Agent Network</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 space-y-1.5">
              {agents.map((agent) => {
                const isWorking = agent.status === "active" || agent.status === "processing";
                const justFinished = agent.status === "complete";
                return (
                  <div
                    key={agent.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-1.5 py-1 transition-all duration-300",
                      isWorking && "bg-primary/10 border border-primary/25 neuro-glow-sm",
                      justFinished && "bg-[var(--neuro-cyan)]/8 border border-[var(--neuro-cyan)]/20"
                    )}
                  >
                    <Circle
                      className={cn(
                        "size-2.5 shrink-0 fill-current",
                        (isWorking || justFinished) && "animate-pulse"
                      )}
                      style={{ color: getAgentStatusColor(agent.status) }}
                    />
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "text-xs block truncate",
                          isWorking ? "text-primary font-medium" : "text-muted-foreground"
                        )}
                      >
                        {agent.name}
                      </span>
                      {(isWorking || justFinished) && agent.task ? (
                        <span className="text-[9px] text-primary/80 truncate block">{agent.task}</span>
                      ) : agent.provider ? (
                        <span className="text-[9px] text-muted-foreground/60 truncate block">
                          {agent.provider}/{agent.model?.split("-").slice(0, 2).join("-") || "—"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 pt-3">
        <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center">
          <Zap className="size-3.5 text-[var(--neuro-amber)] shrink-0" />
          <div className="group-data-[collapsible=icon]:hidden min-w-0">
            <p className="text-[10px] text-muted-foreground">Agent Network</p>
            <p className="text-xs font-semibold text-[var(--neuro-amber)]">
              {agents.filter((a) => a.healthy).length} healthy · {activeAgents} active
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

interface TopBarProps {
  page: Page;
}

const pageTitles: Record<Page, string> = {
  "dashboard": "Dashboard",
  "lecture-studio": "Lecture Studio",
  "tutor": "AI Tutor",
  "knowledge-graph": "Knowledge Graph",
  "revision": "Revision Center",
  "analytics": "Analytics",
  "voice": "Voice",
  "settings": "Agent Configuration",
};

/** Capitalize provider name for display */
function formatProvider(name: string): string {
  if (!name) return "—";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

import { commandLifecycleManager } from "@/services/voice/commandLifecycleManager";
import { persistentVoiceSessionManager } from "@/services/voice/sessionManager";

function TopBar({ page }: TopBarProps) {
  const { voiceStatus, transcript, startListening, providerConfig } = useAgent();
  const { setCompanionExpanded } = useAppStore();

  const isListening = voiceStatus === "listening" || voiceStatus === "responding";
  const isProcessing = voiceStatus === "thinking" || voiceStatus === "executing";

  const handleMicClick = () => {
    if (isListening) {
      void persistentVoiceSessionManager.stopMicrophone();
      return;
    }
    if (isProcessing) {
      commandLifecycleManager.executeStop();
      return;
    }
    startListening();
    setCompanionExpanded(true);
  };

  return (
    <header className="safe-top sticky top-0 z-40 flex h-12 min-h-12 items-center gap-2 border-b border-border/50 bg-background/80 backdrop-blur-sm px-3 sm:gap-3 sm:px-4">
      <SidebarTrigger className="touch-target size-9 shrink-0 text-muted-foreground hover:text-foreground sm:size-7" />
      <Separator orientation="vertical" className="hidden h-4 sm:block" />
      <h1 className="min-w-0 truncate text-sm font-semibold">{pageTitles[page]}</h1>

      {isListening && (
        <span className="hidden min-w-0 truncate rounded border border-border/30 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground animate-pulse min-[480px]:inline-block min-[480px]:max-w-[140px] sm:max-w-xs">
          Hearing: "{transcript || 'Speaking...'}"
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "touch-target size-10 rounded-full border border-border/50 transition-all sm:size-7",
            isListening
              ? "bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/30"
              : "hover:bg-accent text-muted-foreground"
          )}
          onClick={handleMicClick}
          disabled={isProcessing}
          title="Global Voice Command"
        >
          {isProcessing ? (
            <Cpu className="size-3.5 animate-spin text-[var(--neuro-amber)]" />
          ) : (
            <Mic className={cn("size-3.5", isListening && "animate-pulse")} />
          )}
        </Button>
        <Separator orientation="vertical" className="h-4 hidden sm:block" />

        {/* Dynamic Provider Status Badges */}
        {providerConfig.llm_provider && (
          <Badge variant="outline" className="text-[9px] text-[var(--neuro-cyan)] border-[var(--neuro-cyan)]/30 gap-1 hidden sm:flex">
            <CheckCircle className="size-1.5" /> LLM: {formatProvider(providerConfig.llm_provider)}
          </Badge>
        )}
        {providerConfig.memory_provider && (
          <Badge variant="outline" className="text-[9px] text-[var(--neuro-green)] border-[var(--neuro-green)]/30 gap-1 hidden sm:flex">
            <CheckCircle className="size-1.5" /> Mem: {formatProvider(providerConfig.memory_provider)}
          </Badge>
        )}
        {providerConfig.voice_provider && (
          <Badge variant="outline" className="text-[9px] text-[var(--neuro-amber)] border-[var(--neuro-amber)]/30 gap-1 hidden sm:flex">
            <CheckCircle className="size-1.5" /> Voice: {formatProvider(providerConfig.voice_provider)}
          </Badge>
        )}
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentPage } = useAppStore();

  useEffect(() => {
    registerDefaultActions();

    const handleAgentAction = (e: Event) => {
      const action = (e as CustomEvent).detail;
      console.log("[AppLayout] Intercepted Agent Action:", action);
      
      // Route all backend action events to the Action Executor registry
      executeAction(action.action, action);
    };

    window.addEventListener("agent_action", handleAgentAction);
    return () => window.removeEventListener("agent_action", handleAgentAction);
  }, []);

  return (
    <SidebarProvider>
      <NeuroSidebar />
      <SidebarInset className="neuro-grid-bg flex min-h-svh max-h-svh flex-col overflow-hidden">
        <TopBar page={currentPage} />
        <main className="flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden pb-24 md:pb-0">
          {children}
        </main>
      </SidebarInset>
      <AiCompanionPanel />
    </SidebarProvider>
  );
}
