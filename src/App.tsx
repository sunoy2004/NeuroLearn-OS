import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Dashboard } from "@/pages/Dashboard";
import { LectureStudio } from "@/pages/LectureStudio";
import { AiTutor } from "@/pages/AiTutor";
import { KnowledgeGraph } from "@/pages/KnowledgeGraph";
import { RevisionCenter } from "@/pages/RevisionCenter";
import { Analytics } from "@/pages/Analytics";
import { VoiceInterface } from "@/components/VoiceInterface";
import { AgentSettings } from "@/pages/AgentSettings";
import { useAppStore } from "@/store/appStore";
import { AgentContextProvider } from "@/context/AgentContext";
import { agentRegistry } from "@/agents/agentRegistry";
import { agentBootstrap } from "@/agents/bootstrap";
import { Brain, Loader2 } from "lucide-react";

function PageRouter() {
  const { currentPage } = useAppStore();
  switch (currentPage) {
    case "lecture-studio": return <LectureStudio />;
    case "tutor": return <AiTutor />;
    case "knowledge-graph": return <KnowledgeGraph />;
    case "revision": return <RevisionCenter />;
    case "analytics": return <Analytics />;
    case "voice": return <VoiceInterface />;
    case "settings": return <AgentSettings />;
    default: return <Dashboard />;
  }
}

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
      <div className="relative">
        <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Brain className="size-8 text-primary animate-pulse" />
        </div>
        <Loader2 className="size-5 text-primary animate-spin absolute -bottom-1 -right-1" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Initializing NeuroLearn OS</p>
        <p className="text-xs text-muted-foreground mt-1">Connecting to cognitive engine...</p>
      </div>
    </div>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const fetchDashboardData = useAppStore((s) => s.fetchDashboardData);
  const fetchConceptGraph = useAppStore((s) => s.fetchConceptGraph);
  const fetchFlashcards = useAppStore((s) => s.fetchFlashcards);
  const fetchLearningGoals = useAppStore((s) => s.fetchLearningGoals);
  const setPage = useAppStore((s) => s.setPage);

  useEffect(() => {
    agentBootstrap.initialize().catch(() => {});
    const unsub = agentRegistry.subscribe(() => {
      useAppStore.getState().syncAgentsFromRegistry();
    });
    return unsub;
  }, []);

  useEffect(() => {
    Promise.allSettled([
      fetchDashboardData(),
      fetchConceptGraph(),
      fetchFlashcards(),
      fetchLearningGoals()
    ]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchDashboardData, fetchConceptGraph, fetchFlashcards, fetchLearningGoals]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <AgentContextProvider>
      <AppLayout>
        <ErrorBoundary onReset={() => setPage("dashboard")}>
          <PageRouter />
        </ErrorBoundary>
      </AppLayout>
    </AgentContextProvider>
  );
}
