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
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import type { Page } from "@/types";
import { cn } from "@/lib/utils";

const navItems: { id: Page; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "lecture-studio", label: "Lecture Studio", icon: Mic },
  { id: "tutor", label: "AI Tutor", icon: Brain },
  { id: "voice", label: "Voice Control", icon: Volume2, badge: "New" },
  { id: "knowledge-graph", label: "Knowledge Graph", icon: Network },
  { id: "revision", label: "Revision Center", icon: BookOpen, badge: "5" },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const agentDots = [
  { name: "Orchestrator", color: "var(--neuro-cyan)" },
  { name: "Tutor", color: "var(--neuro-green)" },
  { name: "Weakness Detector", color: "var(--neuro-amber)" },
  { name: "Revision Planner", color: "var(--neuro-amber)" },
];

function NeuroSidebar() {
  const { currentPage, setPage, agents } = useAppStore();
  const activeAgents = agents.filter((a) => a.status === "active" || a.status === "processing").length;

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
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Agent Network</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 space-y-2">
              {agentDots.map((a) => (
                <div key={a.name} className="flex items-center gap-2">
                  <Circle className="size-2 fill-current animate-pulse" style={{ color: a.color }} />
                  <span className="text-xs text-muted-foreground">{a.name}</span>
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
            <p className="text-[10px] text-muted-foreground">Lyzr Agents</p>
            <p className="text-xs font-semibold text-[var(--neuro-amber)]">{activeAgents} active</p>
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
};

function TopBar({ page }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4">
      <SidebarTrigger className="size-7 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="h-4" />
      <h1 className="text-sm font-semibold">{pageTitles[page]}</h1>
      <div className="ml-auto flex items-center gap-2">
        <Badge variant="outline" className="text-[9px] text-[var(--neuro-cyan)] border-[var(--neuro-cyan)]/30 gap-1 hidden sm:flex">
          <Circle className="size-1.5 fill-current animate-pulse" /> Omi
        </Badge>
        <Badge variant="outline" className="text-[9px] text-[var(--neuro-green)] border-[var(--neuro-green)]/30 gap-1 hidden sm:flex">
          <Circle className="size-1.5 fill-current animate-pulse" /> Qdrant
        </Badge>
        <Badge variant="outline" className="text-[9px] text-[var(--neuro-amber)] border-[var(--neuro-amber)]/30 gap-1 hidden sm:flex">
          <Circle className="size-1.5 fill-current animate-pulse" /> Lyzr
        </Badge>
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentPage } = useAppStore();

  return (
    <SidebarProvider>
      <NeuroSidebar />
      <SidebarInset className="neuro-grid-bg">
        <TopBar page={currentPage} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
