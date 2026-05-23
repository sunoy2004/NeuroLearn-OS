import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Brain, TrendingUp, Zap, BookOpen, Target, Activity, Sparkles, Clock } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

const weeklyActivity = [
  { day: "Mon", minutes: 45, concepts: 4 },
  { day: "Tue", minutes: 80, concepts: 7 },
  { day: "Wed", minutes: 30, concepts: 2 },
  { day: "Thu", minutes: 120, concepts: 11 },
  { day: "Fri", minutes: 60, concepts: 5 },
  { day: "Sat", minutes: 90, concepts: 8 },
  { day: "Sun", minutes: 25, concepts: 3 },
];

const masteryEvolution = [
  { week: "W1", dbms: 42, os: 38 },
  { week: "W2", dbms: 51, os: 44 },
  { week: "W3", dbms: 58, os: 52 },
  { week: "W4", dbms: 63, os: 60 },
  { week: "W5", dbms: 71, os: 67 },
  { week: "W6", dbms: 78, os: 73 },
];

const cognitiveLoad = [
  { session: "Mon", load: 62 },
  { session: "Tue", load: 78 },
  { session: "Wed", load: 45 },
  { session: "Thu", load: 88 },
  { session: "Fri", load: 71 },
  { session: "Sat", load: 82 },
  { session: "Sun", load: 55 },
];

const retentionConfig = { retention: { label: "Retention %", color: "var(--chart-1)" } };
const minutesConfig = { minutes: { label: "Study Minutes", color: "var(--chart-2)" } };
const dbmsConfig = {
  dbms: { label: "DBMS", color: "var(--chart-1)" },
  os: { label: "OS", color: "var(--chart-2)" },
};
const loadConfig = { load: { label: "Cognitive Load", color: "var(--chart-3)" } };

function ReadinessGauge({ value }: { value: number }) {
  const radius = 80;
  const cx = 110;
  const cy = 110;
  const startAngle = 210;
  const endAngle = 330;
  const totalAngle = 360 - startAngle + endAngle;
  const valueAngle = startAngle + (value / 100) * totalAngle;

  function polarToCartesian(angleDeg: number, r: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(start: number, end: number, r: number) {
    const s = polarToCartesian(start, r);
    const e = polarToCartesian(end, r);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const needle = polarToCartesian(valueAngle, radius - 10);
  const color = value >= 80 ? "var(--neuro-green)" : value >= 60 ? "var(--neuro-amber)" : "var(--neuro-rose)";

  return (
    <svg width="220" height="140" viewBox="0 0 220 140" className="mx-auto">
      <path d={describeArc(startAngle, endAngle, radius)} fill="none" stroke="oklch(0.18 0.02 240)" strokeWidth={14} strokeLinecap="round" />
      <path d={describeArc(startAngle, valueAngle, radius)} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill={color} />
      <text x={cx} y={cy + 28} textAnchor="middle" fontSize={26} fontWeight={700} fill={color}>{value}%</text>
      <text x={cx} y={cy + 46} textAnchor="middle" fontSize={10} fill="oklch(0.52 0.02 240)">Exam Readiness</text>
      <text x={cx - radius + 8} y={cy + 18} textAnchor="middle" fontSize={9} fill="oklch(0.52 0.02 240)">0</text>
      <text x={cx + radius - 8} y={cy + 18} textAnchor="middle" fontSize={9} fill="oklch(0.52 0.02 240)">100</text>
    </svg>
  );
}

const aiInsights = [
  {
    icon: TrendingUp, color: "var(--neuro-green)",
    title: "Mastery Acceleration",
    text: "DBMS mastery improved +36pp over 6 weeks. At this rate, you'll hit 90%+ before your exam.",
  },
  {
    icon: Brain, color: "var(--neuro-cyan)",
    title: "Learning Pattern Detected",
    text: "Peak cognitive performance on Thursdays. Lyzr has scheduled difficult topics accordingly.",
  },
  {
    icon: Zap, color: "var(--neuro-amber)",
    title: "Retention Risk Window",
    text: "3 topics are approaching the forgetting threshold. Optimal revision window: next 48 hours.",
  },
  {
    icon: Target, color: "var(--neuro-rose)",
    title: "Weak Cluster Identified",
    text: "Concurrency Control, Deadlock Prevention, and Serializability form a weak cluster. Targeted session recommended.",
  },
];

export function Analytics() {
  const { retentionData, lectures, concepts, fetchDashboardData } = useAppStore();

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const avgMastery = Math.round(concepts.reduce((s, c) => s + c.mastery, 0) / concepts.length);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Analytics</h2>
          <p className="text-sm text-muted-foreground">Cognitive intelligence report · Lyzr AI analysis · Qdrant insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] text-[var(--neuro-green)] border-[var(--neuro-green)]/30 gap-1">
            <Activity className="size-3" /> Live Analysis
          </Badge>
        </div>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gauge */}
        <Card className="border-border/50 flex flex-col items-center justify-center">
          <CardHeader className="pb-0 text-center w-full">
            <CardTitle className="text-sm font-semibold text-center">Exam Readiness Index</CardTitle>
            <CardDescription className="text-xs text-center">Lyzr composite score</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 pb-4">
            <ReadinessGauge value={73} />
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { label: "Mastery", value: `${avgMastery}%`, color: "text-[var(--neuro-cyan)]" },
                { label: "Retention", value: "81%", color: "text-[var(--neuro-green)]" },
                { label: "Coverage", value: "68%", color: "text-[var(--neuro-amber)]" },
              ].map((s) => (
                <div key={s.label} className="text-center p-2 rounded-lg bg-muted/20 border border-border/30">
                  <p className={cn("text-base font-bold", s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mastery evolution */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Mastery Evolution
            </CardTitle>
            <CardDescription className="text-xs">6-week learning trajectory by subject</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dbmsConfig} className="h-[200px] w-full">
              <LineChart data={masteryEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.02 240)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis domain={[30, 90]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="dbms" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3, fill: "var(--chart-1)" }} />
                <Line type="monotone" dataKey="os" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3, fill: "var(--chart-2)" }} strokeDasharray="4 2" />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly activity */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="size-4 text-primary" /> Weekly Study Activity
            </CardTitle>
            <CardDescription className="text-xs">Minutes studied per day this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={minutesConfig} className="h-[180px] w-full">
              <BarChart data={weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.02 240)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="minutes" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Cognitive load */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Cognitive Load Index
            </CardTitle>
            <CardDescription className="text-xs">Estimated mental effort per session</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={loadConfig} className="h-[180px] w-full">
              <AreaChart data={cognitiveLoad}>
                <defs>
                  <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.02 240)" />
                <XAxis dataKey="session" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="load" stroke="var(--chart-3)" strokeWidth={2} fill="url(#loadGrad)" dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Memory retention */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="size-4 text-primary" /> Memory Retention Curve
              </CardTitle>
              <CardDescription className="text-xs">Ebbinghaus forgetting curve — 7-day window</CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">7 days</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={retentionConfig} className="h-[160px] w-full">
            <AreaChart data={retentionData}>
              <defs>
                <linearGradient id="retGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="retention" stroke="var(--chart-1)" strokeWidth={2} fill="url(#retGrad2)" dot={false} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* AI Intelligence Report */}
      <Card className="border-[var(--neuro-cyan)]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--neuro-cyan)]" /> AI Intelligence Report
          </CardTitle>
          <CardDescription className="text-xs">Lyzr cognitive analysis · Updated after each session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-muted/10">
                <div className="size-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in oklch, ${insight.color} 15%, transparent)` }}>
                  <insight.icon className="size-3.5" style={{ color: insight.color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: insight.color }}>{insight.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lecture impact */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="size-4 text-primary" /> Lecture Impact Analysis
          </CardTitle>
          <CardDescription className="text-xs">Concepts and mastery gain per lecture</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lectures.map((lecture, i) => {
              const gain = [14, 11, 9, 16, 8][i] ?? 10;
              return (
                <div key={lecture.id} className="flex items-center gap-4 p-3 rounded-lg border border-border/40 bg-muted/10">
                  <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="size-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium truncate">{lecture.title}</p>
                      <Badge variant="outline" className="text-[9px] shrink-0 ml-2">{lecture.subject}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-1.5">
                      <span>{lecture.conceptCount} concepts</span>
                      <span>{lecture.flashcardCount} cards generated</span>
                      <span>+{gain}pp mastery avg</span>
                    </div>
                    <Progress value={gain * 6} className="h-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
