import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Brain, Flame, Clock, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Zap, Mic, ChevronRight, Target, BookOpen,
  BarChart3, Sparkles, Activity, Lightbulb,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { ChartContainer, ChartTooltipContent, ChartTooltip } from "@/components/ui/chart";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import type { WeakTopic, AgentStatus } from "@/types";

const retentionConfig = { retention: { label: "Retention %", color: "var(--chart-1)" } };
const masteryConfig = { mastery: { label: "Mastery", color: "var(--chart-2)" } };

function StatCard({ icon: Icon, label, value, sub, color = "text-primary" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card className="border-border/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent pointer-events-none" />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-2xl font-bold tracking-tight", color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className={cn("size-4", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WeakTopicItem({ topic }: { topic: WeakTopic }) {
  const TrendIcon = topic.trend === "declining" ? TrendingDown : topic.trend === "improving" ? TrendingUp : Minus;
  const trendColor = topic.trend === "declining" ? "text-[var(--neuro-rose)]" : topic.trend === "improving" ? "text-[var(--neuro-green)]" : "text-muted-foreground";
  const urgent = topic.daysUntilForgetting <= 2;
  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border transition-colors", urgent ? "border-[var(--neuro-rose)]/30 bg-[var(--neuro-rose)]/5" : "border-border/40 bg-muted/20")}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate">{topic.name}</span>
          {urgent && <AlertTriangle className="size-3 text-[var(--neuro-rose)] shrink-0" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{topic.subject}</span>
          <span className="text-[10px] text-muted-foreground/60">·</span>
          <span className="text-xs text-muted-foreground">Forget in {topic.daysUntilForgetting}d</span>
        </div>
        <Progress value={topic.score} className="h-1 mt-2" />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-sm font-bold">{topic.score}%</span>
        <TrendIcon className={cn("size-3", trendColor)} />
      </div>
    </div>
  );
}

function AgentItem({ agent }: { agent: AgentStatus }) {
  const colors: Record<string, string> = {
    active: "text-[var(--neuro-cyan)] bg-[var(--neuro-cyan)]/10",
    processing: "text-[var(--neuro-amber)] bg-[var(--neuro-amber)]/10",
    complete: "text-[var(--neuro-green)] bg-[var(--neuro-green)]/10",
    idle: "text-muted-foreground bg-muted/30",
  };
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0", colors[agent.status])}>{agent.status}</div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{agent.name}</span>
        {agent.task && <p className="text-xs text-muted-foreground truncate">{agent.task}</p>}
        {agent.progress !== undefined && <Progress value={agent.progress} className="h-1 mt-1" />}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { 
    setPage, 
    profile, 
    retentionData, 
    masteryData, 
    weakTopics, 
    lectures, 
    agents, 
    fetchDashboardData 
  } = useAppStore();

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Hero */}
      <div className="relative rounded-xl border border-[var(--neuro-cyan)]/20 bg-card overflow-hidden p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/3 pointer-events-none" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-4 text-primary" />
              <span className="text-xs uppercase tracking-widest text-primary/70 font-semibold">NEUROLEARN OS — COGNITIVE ENGINE</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Good morning, {profile.name}</h1>
            <p className="text-muted-foreground text-sm max-w-lg">
              Your AI learning companion has processed <span className="text-primary font-semibold">{profile.conceptsMastered} concepts</span> and detected{" "}
              <span className="text-[var(--neuro-rose)] font-semibold">5 weak topics</span> at risk of forgetting.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={() => setPage("lecture-studio")} className="gap-2 neuro-glow-sm">
              <Mic className="size-3.5" /> Start Recording
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage("tutor")} className="gap-2">
              <Brain className="size-3.5" /> Ask Tutor
            </Button>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-3 rounded-lg border border-[var(--neuro-rose)]/30 bg-[var(--neuro-rose)]/5 px-4 py-2.5">
          <AlertTriangle className="size-4 text-[var(--neuro-rose)] shrink-0" />
          <p className="text-sm">
            <span className="font-semibold text-[var(--neuro-rose)]">Retention Alert:</span>{" "}
            <span className="text-foreground/80">You are likely to forget <strong>Deadlock Prevention</strong> within 2 days. Revision recommended.</span>
          </p>
          <Button variant="ghost" size="sm" className="ml-auto shrink-0 text-[var(--neuro-rose)] hover:text-[var(--neuro-rose)] hover:bg-[var(--neuro-rose)]/10" onClick={() => setPage("revision")}>
            Revise Now <ChevronRight className="size-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Flame} label="Study Streak" value={`${profile.studyStreak}d`} sub="Personal best" color="text-[var(--neuro-amber)]" />
        <StatCard icon={Clock} label="Study Hours" value={profile.totalHours} sub="This month" color="text-[var(--neuro-cyan)]" />
        <StatCard icon={Brain} label="Concepts" value={profile.conceptsMastered} sub="Mastered" color="text-[var(--neuro-green)]" />
        <StatCard icon={Target} label="Exam Readiness" value={`${profile.examReadiness}%`} sub="Estimated" color="text-primary" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="size-4 text-primary" /> Memory Retention Curve
                </CardTitle>
                <CardDescription className="text-xs">Semantic memory health over time</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">7 days</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={retentionConfig} className="h-[180px] w-full">
              <AreaChart data={retentionData}>
                <defs>
                  <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="retention" stroke="var(--chart-1)" strokeWidth={2} fill="url(#retGrad)" dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Subject Mastery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={masteryConfig} className="h-[180px] w-full">
              <RadarChart data={masteryData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                <Radar name="mastery" dataKey="mastery" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} strokeWidth={1.5} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      <Card className="border-[var(--neuro-cyan)]/30 bg-gradient-to-br from-[var(--neuro-cyan)]/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="size-4 text-[var(--neuro-cyan)]" /> Personalized Recommendations
          </CardTitle>
          <CardDescription className="text-xs">Based on your learning patterns and weak areas</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-[var(--neuro-amber)]/30 bg-[var(--neuro-amber)]/5">
            <p className="text-xs font-semibold text-[var(--neuro-amber)] uppercase tracking-widest mb-1">Next Topic</p>
            <p className="text-sm text-foreground font-medium">Learn Query Optimization</p>
            <p className="text-xs text-muted-foreground mt-1">Builds on your BCNF foundation (82% mastery)</p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--neuro-rose)]/30 bg-[var(--neuro-rose)]/5">
            <p className="text-xs font-semibold text-[var(--neuro-rose)] uppercase tracking-widest mb-1">Urgent</p>
            <p className="text-sm text-foreground font-medium">Revise Deadlock Prevention</p>
            <p className="text-xs text-muted-foreground mt-1">Forgetting in 2 days • 15 min session</p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--neuro-green)]/30 bg-[var(--neuro-green)]/5">
            <p className="text-xs font-semibold text-[var(--neuro-green)] uppercase tracking-widest mb-1">Strength</p>
            <p className="text-sm text-foreground font-medium">ACID Properties Mastered</p>
            <p className="text-xs text-muted-foreground mt-1">Consider deeper topics or teaching</p>
          </div>
        </CardContent>
      </Card>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="size-4 text-[var(--neuro-rose)]" /> At-Risk Topics
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPage("revision")}>
                View all <ChevronRight className="size-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {weakTopics.slice(0, 4).map((t) => <WeakTopicItem key={t.name} topic={t} />)}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="size-4 text-primary" /> Recent Lectures
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPage("lecture-studio")}>
                Studio <ChevronRight className="size-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {lectures.slice(0, 4).map((lecture) => (
              <div key={lecture.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer">
                <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="size-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{lecture.title}</p>
                  <p className="text-[10px] text-muted-foreground">{lecture.subject} · {lecture.duration}m · {lecture.conceptCount} concepts</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{lecture.flashcardCount} cards</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="size-4 text-[var(--neuro-amber)]" /> Agent Activity
            </CardTitle>
            <CardDescription className="text-xs">Lyzr orchestration network</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 divide-y divide-border/30">
            {agents.map((agent) => <AgentItem key={agent.id} agent={agent} />)}
          </CardContent>
        </Card>
      </div>

      {/* Weekly goal */}
      <Card className="border-border/50">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Weekly Learning Goal</span>
                <span className="text-sm font-bold text-primary">{profile.weeklyGoalProgress}%</span>
              </div>
              <Progress value={profile.weeklyGoalProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">5 of 7 days active · 3 lectures processed · 12 concepts strengthened</p>
            </div>
            <Separator orientation="vertical" className="h-12 hidden sm:block" />
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Learning style detected</p>
              <p className="text-sm font-semibold text-primary">{profile.preferredStyle}</p>
              <p className="text-[10px] text-muted-foreground/60">Qdrant profile · 47 interactions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
