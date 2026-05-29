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
  Volume2,
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
  { id: "voice", label: "Voice Control", icon: Volume2, badge: "New" },
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
                    onClick={() => setPage(item.id)}
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
            <div className="px-2 space-y-2">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-2">
                  <Circle
                    className={cn(
                      "size-2 fill-current",
                      (agent.status === "active" || agent.status === "processing") && "animate-pulse"
                    )}
                    style={{ color: getAgentStatusColor(agent.status) }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-muted-foreground block truncate">{agent.name}</span>
                    {agent.provider && (
                      <span className="text-[9px] text-muted-foreground/60 truncate block">
                        {agent.provider}/{agent.model?.split("-").slice(0, 2).join("-") || "—"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
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
  "voice": "Voice Control",
  "knowledge-graph": "Knowledge Graph",
  "revision": "Revision Center",
  "analytics": "Analytics",
  "settings": "Agent Configuration",
};

/** Capitalize provider name for display */
function formatProvider(name: string): string {
  if (!name) return "—";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

import { commandLifecycleManager } from "@/services/voice/commandLifecycleManager";

function TopBar({ page }: TopBarProps) {
  const { voiceStatus, transcript, startListening, providerConfig } = useAgent();
  const { companionExpanded, setCompanionExpanded } = useAppStore();

  const isListening = voiceStatus === "listening" || voiceStatus === "responding";
  const isProcessing = voiceStatus === "thinking" || voiceStatus === "executing";
  const isExpanded = companionExpanded;

  const handleMicClick = () => {
    if (isListening || isProcessing) {
      commandLifecycleManager.executeStop();
    } else {
      startListening();
      setCompanionExpanded(true);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4">
      <SidebarTrigger className="size-7 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="h-4" />
      <h1 className="text-sm font-semibold">{pageTitles[page]}</h1>

      {isListening && (
        <span className="text-[11px] text-muted-foreground animate-pulse max-w-[200px] sm:max-w-xs truncate ml-2 bg-muted/30 px-2 py-0.5 rounded border border-border/30">
          Hearing: "{transcript || 'Speaking...'}"
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 rounded-full border border-border/50 transition-all",
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
      <SidebarInset className="neuro-grid-bg">
        <TopBar page={currentPage} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
      <AiCompanionPanel />
    </SidebarProvider>
  );
}
