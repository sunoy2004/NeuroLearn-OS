import { Badge } from "@/components/ui/badge";
import type { VoiceIntent } from "@/types";
import {
  Mic,
  FileQuestion,
  GraduationCap,
  RefreshCw,
  BarChart3,
  Layers,
  Map,
  Target,
  AlertTriangle,
  TrendingUp,
  HelpCircle,
} from "lucide-react";

const intentConfig: Record<
  VoiceIntent,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  LECTURE_START: { label: "Lecture", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Mic },
  LECTURE_STOP: { label: "Stop", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Mic },
  QUIZ_REQUEST: { label: "Quiz", color: "bg-purple-500/10 text-purple-600 border-purple-500/30", icon: FileQuestion },
  TUTORING_REQUEST: { label: "Tutoring", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: GraduationCap },
  REVISION_START: { label: "Revision", color: "bg-orange-500/10 text-orange-600 border-orange-500/30", icon: RefreshCw },
  ANALYTICS_QUERY: { label: "Analytics", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30", icon: BarChart3 },
  FLASHCARD_CREATE: { label: "Flashcards", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Layers },
  ROADMAP_CREATE: { label: "Roadmap", color: "bg-teal-500/10 text-teal-600 border-teal-500/30", icon: Map },
  GOAL_SET: { label: "Goal", color: "bg-rose-500/10 text-rose-600 border-rose-500/30", icon: Target },
  WEAK_AREAS_QUERY: { label: "Weak Areas", color: "bg-red-500/10 text-red-600 border-red-500/30", icon: AlertTriangle },
  PROGRESS_QUERY: { label: "Progress", color: "bg-green-500/10 text-green-600 border-green-500/30", icon: TrendingUp },
  EXPLANATION_REQUEST: { label: "Explanation", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30", icon: GraduationCap },
  UNKNOWN: { label: "Unknown", color: "bg-gray-500/10 text-gray-600 border-gray-500/30", icon: HelpCircle },
};

interface IntentBadgeProps {
  intent: VoiceIntent;
  compact?: boolean;
}

export function IntentBadge({ intent, compact = false }: IntentBadgeProps) {
  const config = intentConfig[intent] || intentConfig.UNKNOWN;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`text-[10px] font-medium ${config.color}`}>
      <Icon className={compact ? "size-2.5" : "size-3 mr-1"} />
      {!compact && config.label}
    </Badge>
  );
}
