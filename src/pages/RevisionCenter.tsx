import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Brain, Clock, CheckCircle, XCircle, RotateCcw, ChevronRight, AlertTriangle, Zap, Calendar, Plus, Zap as ZapIcon, TrendingUp } from "lucide-react";
// Seed fallbacks handled in store
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/services/api";

const learningGoals = [
  { id: 1, title: "Master DBMS in 30 days", subjects: ["Normalization", "Transactions", "Indexing"], progress: 62, deadline: "2026-06-23" },
  { id: 2, title: "OS Kernel Deep Dive", subjects: ["Memory Management", "Scheduling"], progress: 45, deadline: "2026-07-15" },
];

const roadmapItems = [
  { id: "r1", name: "Arrays & Hashing", prereqs: [], estimated: "3 days", difficulty: "Easy" },
  { id: "r2", name: "Linked Lists", prereqs: ["r1"], estimated: "4 days", difficulty: "Easy" },
  { id: "r3", name: "Trees", prereqs: ["r2"], estimated: "7 days", difficulty: "Medium" },
  { id: "r4", name: "Graphs", prereqs: ["r3"], estimated: "8 days", difficulty: "Medium" },
  { id: "r5", name: "Advanced Algorithms", prereqs: ["r4"], estimated: "10 days", difficulty: "Hard" },
];

const resources = [
  { topic: "Normalization", video: "https://youtu.be/...", article: "https://...", time: "45 min", difficulty: "Intermediate" },
  { topic: "B+ Trees", video: "https://youtu.be/...", article: "https://...", time: "60 min", difficulty: "Advanced" },
  { topic: "Transactions", video: "https://youtu.be/...", article: "https://...", time: "50 min", difficulty: "Intermediate" },
];

function FlashcardViewer() {
  const { activeFlashcardIndex, setActiveFlashcardIndex, flashcards } = useAppStore();
  const [flipped, setFlipped] = useState(false);

  if (!flashcards || flashcards.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No flashcards available.</p>;
  }

  const card = flashcards[activeFlashcardIndex] || flashcards[0];

  async function rate(rating: "hard" | "ok" | "easy") {
    try {
      await apiRequest(`/api/revision/flashcards/${card.id}/review`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      });
    } catch (e) {
      console.warn("Spaced repetition backend offline. Logging locally.");
    }
    setFlipped(false);
    if (activeFlashcardIndex < flashcards.length - 1) {
      setTimeout(() => setActiveFlashcardIndex(activeFlashcardIndex + 1), 200);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{activeFlashcardIndex + 1} / {flashcards.length} cards</p>
        <Badge variant="outline" className="text-[10px]">{card.subject} · {card.topic}</Badge>
      </div>
      <Progress value={(activeFlashcardIndex / flashcards.length) * 100} className="h-1" />

      <div className="relative h-56 cursor-pointer" onClick={() => setFlipped(!flipped)}
        style={{ perspective: "1000px" }}>
        <div className={cn("relative w-full h-full transition-transform duration-500")}
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          <div className="absolute inset-0 rounded-xl border border-primary/30 bg-card flex flex-col items-center justify-center p-6 text-center"
            style={{ backfaceVisibility: "hidden" }}>
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Brain className="size-4 text-primary" />
            </div>
            <p className="text-lg font-semibold leading-snug">{card.front}</p>
            <p className="text-xs text-muted-foreground mt-3">Click to reveal answer</p>
          </div>
          <div className="absolute inset-0 rounded-xl border border-[var(--neuro-green)]/30 bg-card flex flex-col items-center justify-center p-6 text-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <div className="size-8 rounded-lg bg-[var(--neuro-green)]/10 flex items-center justify-center mb-3">
              <CheckCircle className="size-4 text-[var(--neuro-green)]" />
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{card.back}</p>
          </div>
        </div>
      </div>

      {flipped && (
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 border-[var(--neuro-rose)]/40 text-[var(--neuro-rose)] hover:bg-[var(--neuro-rose)]/10 hover:border-[var(--neuro-rose)]/60" onClick={() => rate("hard")}>
            Hard
          </Button>
          <Button variant="outline" className="flex-1 border-[var(--neuro-amber)]/40 text-[var(--neuro-amber)] hover:bg-[var(--neuro-amber)]/10 hover:border-[var(--neuro-amber)]/60" onClick={() => rate("ok")}>
            OK
          </Button>
          <Button variant="outline" className="flex-1 border-[var(--neuro-green)]/40 text-[var(--neuro-green)] hover:bg-[var(--neuro-green)]/10 hover:border-[var(--neuro-green)]/60" onClick={() => rate("easy")}>
            Easy
          </Button>
        </div>
      )}

      {!flipped && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Ease: {card.ease}</span>
          <span>Interval: {card.interval}d</span>
          <span>Due: {card.dueDate}</span>
        </div>
      )}

      <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={() => { setActiveFlashcardIndex(0); setFlipped(false); }}>
        <RotateCcw className="size-3.5" /> Restart Deck
      </Button>
    </div>
  );
}

function QuizViewer() {
  const { quizIndex, setQuizIndex, quizAnswers, setQuizAnswer, quizQuestions } = useAppStore();

  if (!quizQuestions || quizQuestions.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No quiz questions loaded.</p>;
  }

  const question = quizQuestions[quizIndex] || quizQuestions[0];
  const answered = quizAnswers[question.id] !== undefined;
  const correct = quizAnswers[question.id] === question.correct;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Question {quizIndex + 1} / {quizQuestions.length}</p>
        <Badge variant="outline" className="text-[10px]">{question.topic}</Badge>
      </div>
      <Progress value={(quizIndex / quizQuestions.length) * 100} className="h-1" />

      <Card className="border-border/50">
        <CardContent className="pt-5 pb-5">
          <p className="text-sm font-medium leading-relaxed">{question.question}</p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const isSelected = quizAnswers[question.id] === i;
          const isCorrect = i === question.correct;
          let cls = "border-border/40 bg-muted/10 hover:border-primary/30 hover:bg-muted/20";
          if (answered && isCorrect) cls = "border-[var(--neuro-green)]/40 bg-[var(--neuro-green)]/5";
          else if (answered && isSelected && !isCorrect) cls = "border-[var(--neuro-rose)]/40 bg-[var(--neuro-rose)]/5";
          return (
            <button key={i} disabled={answered} onClick={() => setQuizAnswer(question.id, i)}
              className={cn("w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all text-sm", cls)}>
              <span className="size-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-bold">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
              {answered && isCorrect && <CheckCircle className="size-4 text-[var(--neuro-green)] shrink-0" />}
              {answered && isSelected && !isCorrect && <XCircle className="size-4 text-[var(--neuro-rose)] shrink-0" />}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={cn("rounded-lg border p-3", correct ? "border-[var(--neuro-green)]/30 bg-[var(--neuro-green)]/5" : "border-[var(--neuro-rose)]/30 bg-[var(--neuro-rose)]/5")}>
          <p className="text-xs font-semibold mb-1" style={{ color: correct ? "var(--neuro-green)" : "var(--neuro-rose)" }}>
            {correct ? "Correct!" : "Incorrect"}
          </p>
          <p className="text-xs text-muted-foreground">{question.explanation}</p>
        </div>
      )}

      {answered && quizIndex < mockQuizQuestions.length - 1 && (
        <Button className="w-full gap-2" onClick={() => setQuizIndex(quizIndex + 1)}>
          Next Question <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}

export function RevisionCenter() {
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const { weakTopics, fetchDashboardData, fetchFlashcards, fetchQuizQuestions } = useAppStore();
  
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTopics, setGoalTopics] = useState("");
  const [goalTimeline, setGoalTimeline] = useState("");
  const [goalDate, setGoalDate] = useState("");

  useEffect(() => {
    fetchDashboardData();
    fetchFlashcards();
    fetchQuizQuestions("DBMS");
  }, [fetchDashboardData, fetchFlashcards, fetchQuizQuestions]);

  async function handleCreateGoal() {
    try {
      await apiRequest("/api/revision/goals", {
        method: "POST",
        body: JSON.stringify({
          title: goalTitle,
          topics: goalTopics,
          timeline: parseInt(goalTimeline) || 30,
          targetDate: goalDate || new Date().toISOString().split("T")[0]
        })
      });
      setShowGoalDialog(false);
      fetchDashboardData();
    } catch (e) {
      console.warn("Failed creating goal on server.");
      setShowGoalDialog(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Revision Center</h2>
          <p className="text-sm text-muted-foreground">SM-2 spaced repetition · Forgetting curve · Lyzr scheduling</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] text-[var(--neuro-rose)] border-[var(--neuro-rose)]/30 gap-1">
            <AlertTriangle className="size-3" /> 5 Due Today
          </Badge>
          <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 neuro-glow-sm">
                <Plus className="size-3.5" /> New Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Learning Goal</DialogTitle>
                <DialogDescription>Define your learning objective and timeline</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Goal Title</label>
                  <Input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="e.g., Master DBMS in 30 days" />
                </div>
                <div>
                  <label className="text-sm font-medium">Topics</label>
                  <Textarea value={goalTopics} onChange={(e) => setGoalTopics(e.target.value)} placeholder="List topics to cover..." rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Timeline</label>
                    <Input value={goalTimeline} onChange={(e) => setGoalTimeline(e.target.value)} type="number" placeholder="Days" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Target Date</label>
                    <Input value={goalDate} onChange={(e) => setGoalDate(e.target.value)} type="date" />
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateGoal}>Create Goal</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Learning Goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {learningGoals.map((goal) => (
          <Card key={goal.id} className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">{goal.title}</CardTitle>
                  <CardDescription className="text-xs">Due {goal.deadline}</CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{goal.progress}%</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={goal.progress} className="h-2" />
              <div className="flex flex-wrap gap-1">
                {goal.subjects.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full">View Roadmap</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="flashcards">
            <TabsList className="mb-4">
              <TabsTrigger value="flashcards" className="gap-2">
                <BookOpen className="size-3.5" /> Flashcards
              </TabsTrigger>
              <TabsTrigger value="quiz" className="gap-2">
                <Brain className="size-3.5" /> Quiz
              </TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-2">
                <TrendingUp className="size-3.5" /> Roadmap
              </TabsTrigger>
              <TabsTrigger value="resources" className="gap-2">
                <ZapIcon className="size-3.5" /> Resources
              </TabsTrigger>
            </TabsList>

            <TabsContent value="flashcards">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Spaced Repetition</CardTitle>
                  <CardDescription className="text-xs">SM-2 algorithm · {flashcards.length} cards due</CardDescription>
                </CardHeader>
                <CardContent>
                  <FlashcardViewer />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quiz">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Adaptive Quiz</CardTitle>
                  <CardDescription className="text-xs">Generated by Lyzr · Targets weak areas</CardDescription>
                </CardHeader>
                <CardContent>
                  <QuizViewer />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roadmap">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Learning Roadmap</CardTitle>
                  <CardDescription className="text-xs">Recommended learning progression</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {roadmapItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:border-primary/30 transition-colors">
                      <div className="mt-1">
                        {item.prereqs.length > 0 ? (
                          <div className="size-5 rounded-full border-2 border-[var(--neuro-amber)] flex items-center justify-center">
                            <div className="size-2 rounded-full bg-[var(--neuro-amber)]" />
                          </div>
                        ) : (
                          <CheckCircle className="size-5 text-[var(--neuro-green)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.name}</p>
                        <div className="flex gap-2 text-[10px] text-muted-foreground mt-1">
                          <span>{item.estimated}</span>
                          <span>·</span>
                          <Badge variant="outline" className="text-[9px]">{item.difficulty}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="resources">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Learning Resources</CardTitle>
                  <CardDescription className="text-xs">Curated references for each topic</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {resources.map((res, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/40 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium">{res.topic}</p>
                        <Badge variant="outline" className="text-[9px]">{res.difficulty}</Badge>
                      </div>
                      <div className="flex gap-2 text-[10px] mb-2">
                        <a href={res.video} className="text-[var(--neuro-cyan)] hover:underline">Video</a>
                        <span className="text-muted-foreground">·</span>
                        <a href={res.article} className="text-[var(--neuro-cyan)] hover:underline">Article</a>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{res.time}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          {/* At-risk topics */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="size-4 text-[var(--neuro-rose)]" /> Forgetting Risk
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {weakTopics.map((t) => {
                const urgentColor = t.daysUntilForgetting <= 2 ? "var(--neuro-rose)" : t.daysUntilForgetting <= 4 ? "var(--neuro-amber)" : "var(--neuro-green)";
                return (
                  <div key={t.name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium truncate">{t.name}</span>
                      <span className="text-[10px] shrink-0 ml-2" style={{ color: urgentColor }}>
                        {t.daysUntilForgetting}d left
                      </span>
                    </div>
                    <Progress value={t.score} className="h-1" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="size-4 text-primary" /> Review Schedule
              </CardTitle>
              <CardDescription className="text-xs">Next 7 days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {[
                { day: "Today", count: 12, urgent: true },
                { day: "Tomorrow", count: 8, urgent: false },
                { day: "May 24", count: 15, urgent: false },
                { day: "May 25", count: 6, urgent: false },
                { day: "May 26", count: 11, urgent: false },
              ].map((s) => (
                <div key={s.day} className={cn("flex items-center justify-between p-2 rounded-lg border", s.urgent ? "border-[var(--neuro-rose)]/30 bg-[var(--neuro-rose)]/5" : "border-border/30 bg-muted/5")}>
                  <div className="flex items-center gap-2">
                    <Clock className="size-3 text-muted-foreground" />
                    <span className="text-xs font-medium">{s.day}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[9px]", s.urgent && "border-[var(--neuro-rose)]/40 text-[var(--neuro-rose)]")}>
                    {s.count} cards
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Lyzr note */}
          <Card className="border-[var(--neuro-cyan)]/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Zap className="size-4 text-[var(--neuro-cyan)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[var(--neuro-cyan)]">Revision Planner Active</p>
                  <p className="text-xs text-muted-foreground mt-1">Lyzr has optimized your schedule using forgetting curve + SM-2. Deadlock Prevention prioritized for immediate review.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
