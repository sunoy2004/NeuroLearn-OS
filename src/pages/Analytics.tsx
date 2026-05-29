import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Brain, TrendingUp, Zap, BookOpen, Target, Activity, Sparkles, Clock, Lightbulb } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

const retentionConfig = { retention: { label: "Retention %", color: "var(--chart-1)" } };
const minutesConfig = { minutes: { label: "Study Minutes", color: "var(--chart-2)" } };
const masteryBarConfig = { mastery: { label: "Mastery %", color: "var(--chart-1)" } };

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
    </svg>
  );
}

export function Analytics() {
  const { retentionData, masteryData, lectures, concepts, profile, fetchDashboardData } = useAppStore();

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const avgMastery = concepts.length > 0
    ? Math.round(concepts.reduce((s, c) => s + c.mastery, 0) / concepts.length)
    : 0;

  const avgRetention = concepts.length > 0
    ? Math.round(concepts.reduce((s, c) => s + c.retention, 0) / concepts.length)
    : retentionData.length > 0
      ? Math.round(retentionData[retentionData.length - 1]?.retention ?? 0)
      : 0;

  const coveragePct = lectures.length > 0 && concepts.length > 0
    ? Math.min(100, Math.round((concepts.length / (lectures.reduce((s, l) => s + l.conceptCount, 0) || 1)) * 100))
    : concepts.length > 0 ? 100 : 0;

  const weeklyActivity = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const buckets: Record<string, number> = {};
    days.forEach((d) => { buckets[d] = 0; });
    lectures.forEach((lec) => {
      try {
        const d = new Date(lec.date);
        const day = days[d.getDay()];
        buckets[day] = (buckets[day] || 0) + (lec.duration || 0);
      } catch {
        buckets["Mon"] = (buckets["Mon"] || 0) + (lec.duration || 0);
      }
    });
    return days.map((day) => ({ day, minutes: buckets[day] || 0 }));
  }, [lectures]);

  const masteryBySubject = masteryData.filter((m) => m.subject !== "No data yet");
  const insights = profile.insights ?? [];

  const hasWeeklyData = weeklyActivity.some((d) => d.minutes > 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Analytics</h2>
          <p className="text-sm text-muted-foreground">Live metrics from your lectures, concepts, and reviews</p>
        </div>
        <Badge variant="outline" className="text-[10px] text-[var(--neuro-green)] border-[var(--neuro-green)]/30 gap-1">
          <Activity className="size-3" /> Live Data
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-border/50 flex flex-col items-center justify-center">
          <CardHeader className="pb-0 text-center w-full">
            <CardTitle className="text-sm font-semibold text-center">Exam Readiness Index</CardTitle>
            <CardDescription className="text-xs text-center">Composite from concept mastery</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 pb-4">
            <ReadinessGauge value={profile.examReadiness || avgMastery} />
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { label: "Mastery", value: `${avgMastery}%`, color: "text-[var(--neuro-cyan)]" },
                { label: "Retention", value: `${avgRetention}%`, color: "text-[var(--neuro-green)]" },
                { label: "Coverage", value: `${coveragePct}%`, color: "text-[var(--neuro-amber)]" },
              ].map((s) => (
                <div key={s.label} className="text-center p-2 rounded-lg bg-muted/20 border border-border/30">
                  <p className={cn("text-base font-bold", s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Subject Mastery
            </CardTitle>
            <CardDescription className="text-xs">Current mastery by subject from knowledge graph</CardDescription>
          </CardHeader>
          <CardContent>
            {masteryBySubject.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-16">Record lectures to populate subject mastery.</p>
            ) : (
              <ChartContainer config={masteryBarConfig} className="h-[200px] w-full">
                <BarChart data={masteryBySubject}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.02 240)" />
                  <XAxis dataKey="subject" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="mastery" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="size-4 text-primary" /> Lecture Activity
            </CardTitle>
            <CardDescription className="text-xs">Minutes recorded per day of week</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasWeeklyData ? (
              <p className="text-xs text-muted-foreground text-center py-16">No lecture activity recorded yet.</p>
            ) : (
              <ChartContainer config={minutesConfig} className="h-[180px] w-full">
                <BarChart data={weeklyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.02 240)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="minutes" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="size-4 text-primary" /> Concept Retention Spread
            </CardTitle>
            <CardDescription className="text-xs">Retention scores across indexed concepts</CardDescription>
          </CardHeader>
          <CardContent>
            {concepts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-16">No concepts indexed yet.</p>
            ) : (
              <ChartContainer config={retentionConfig} className="h-[180px] w-full">
                <BarChart data={concepts.slice(0, 8).map((c) => ({ name: c.name.slice(0, 12), retention: Math.round(c.retention) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.02 240)" />
                  <XAxis dataKey="name" tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="retention" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="size-4 text-primary" /> Memory Retention Curve
              </CardTitle>
              <CardDescription className="text-xs">7-day retention trend from concept data</CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">7 days</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {retentionData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-12">No retention history yet.</p>
          ) : (
            <ChartContainer config={retentionConfig} className="h-[160px] w-full">
              <AreaChart data={retentionData}>
                <defs>
                  <linearGradient id="retGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="retention" stroke="var(--chart-1)" strokeWidth={2} fill="url(#retGrad2)" dot={false} />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-[var(--neuro-cyan)]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--neuro-cyan)]" /> Learning Insights
          </CardTitle>
          <CardDescription className="text-xs">Generated from your actual study activity</CardDescription>
        </CardHeader>
        <CardContent>
          {insights.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Record lectures and complete quizzes to generate insights.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.map((text, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-muted/10">
                  <Lightbulb className="size-4 text-[var(--neuro-cyan)] shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="size-4 text-primary" /> Lecture Impact
          </CardTitle>
          <CardDescription className="text-xs">Concepts and materials generated per lecture</CardDescription>
        </CardHeader>
        <CardContent>
          {lectures.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No lectures processed yet.</p>
          ) : (
            <div className="space-y-3">
              {lectures.map((lecture) => (
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
                      <span>{lecture.flashcardCount} flashcards</span>
                      <span>{lecture.duration}m duration</span>
                    </div>
                    <Progress value={Math.min(100, lecture.conceptCount * 15)} className="h-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
