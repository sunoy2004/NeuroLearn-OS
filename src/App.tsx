import { AppLayout } from "@/components/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { LectureStudio } from "@/pages/LectureStudio";
import { AiTutor } from "@/pages/AiTutor";
import { KnowledgeGraph } from "@/pages/KnowledgeGraph";
import { RevisionCenter } from "@/pages/RevisionCenter";
import { Analytics } from "@/pages/Analytics";
import { VoiceInterface } from "@/components/VoiceInterface";
import { useAppStore } from "@/store/appStore";

function PageRouter() {
  const { currentPage } = useAppStore();
  switch (currentPage) {
    case "lecture-studio": return <LectureStudio />;
    case "tutor": return <AiTutor />;
    case "knowledge-graph": return <KnowledgeGraph />;
    case "revision": return <RevisionCenter />;
    case "analytics": return <Analytics />;
    case "voice": return <VoiceInterface />;
    default: return <Dashboard />;
  }
}

export default function App() {
  return (
    <AppLayout>
      <PageRouter />
    </AppLayout>
  );
}
