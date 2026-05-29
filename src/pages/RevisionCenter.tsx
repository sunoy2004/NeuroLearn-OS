import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Brain, Clock, CheckCircle, XCircle, RotateCcw, ChevronRight, AlertTriangle, Zap, Calendar, Plus, Zap as ZapIcon, TrendingUp, FileText, ExternalLink } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import { quizStore } from "@/services/quizStore";
import { apiRequest } from "@/services/api";
import { useAgent } from "@/context/AgentContext";

function FlashcardViewer() {
  const activeFlashcardIndex = useAppStore((s) => s.activeFlashcardIndex);
  const setActiveFlashcardIndex = useAppStore((s) => s.setActiveFlashcardIndex);
  const flashcards = useAppStore((s) => s.flashcards);
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
          {/* Front */}
          <div className="absolute inset-0 rounded-xl border border-primary/30 bg-card flex flex-col items-center justify-center p-6 text-center"
            style={{ backfaceVisibility: "hidden" }}>
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Brain className="size-4 text-primary" />
            </div>
            <p className="text-lg font-semibold leading-snug">{card.front}</p>
            <p className="text-xs text-muted-foreground mt-3">Click to reveal answer</p>
          </div>
          {/* Back */}
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
          <span>Due: {card.dueDate || "Today"}</span>
        </div>
      )}

      <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={() => { setActiveFlashcardIndex(0); setFlipped(false); }}>
        <RotateCcw className="size-3.5" /> Restart Deck
      </Button>
    </div>
  );
}

function QuizViewer() {
  const quizIndex = useAppStore((s) => s.quizIndex);
  const setQuizIndex = useAppStore((s) => s.setQuizIndex);
  const quizAnswers = useAppStore((s) => s.quizAnswers);
  const setQuizAnswer = useAppStore((s) => s.setQuizAnswer);
  const quizQuestions = useAppStore((s) => s.quizQuestions);

  if (!quizQuestions || quizQuestions.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No quiz questions loaded.</p>;
  }

  const question = quizQuestions[quizIndex] || quizQuestions[0];
  const answered = quizAnswers[question.id] !== undefined;
  const correct = quizAnswers[question.id] === question.correct;

  function handleAnswer(index: number) {
    setQuizAnswer(question.id, index);
    quizStore.recordAttempt(question.id, question.topic, index, question.correct);
  }

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
            <button key={i} disabled={answered} onClick={() => handleAnswer(i)}
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

      {answered && quizIndex < quizQuestions.length - 1 && (
        <Button className="w-full gap-2" onClick={() => setQuizIndex(quizIndex + 1)}>
          Next Question <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}

export function RevisionCenter() {
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("flashcards");

  const weakTopics = useAppStore((s) => s.weakTopics);
  const fetchDashboardData = useAppStore((s) => s.fetchDashboardData);
  const fetchFlashcards = useAppStore((s) => s.fetchFlashcards);
  const fetchQuizQuestions = useAppStore((s) => s.fetchQuizQuestions);
  const flashcards = useAppStore((s) => s.flashcards);
  const learningGoals = useAppStore((s) => s.learningGoals);
  const fetchLearningGoals = useAppStore((s) => s.fetchLearningGoals);
  const lectures = useAppStore((s) => s.lectures);
  const profile = useAppStore((s) => s.profile);
  
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTopics, setGoalTopics] = useState("");
  const [goalTimeline, setGoalTimeline] = useState("");
  const [goalDate, setGoalDate] = useState("");

  useEffect(() => {
    fetchDashboardData();
    fetchFlashcards();
    fetchLearningGoals();
  }, [fetchDashboardData, fetchFlashcards, fetchLearningGoals]);

  // Set initial selected goal and lecture if available
  useEffect(() => {
    if (learningGoals.length > 0 && selectedGoalId === null) {
      setSelectedGoalId(learningGoals[0].id);
    }
  }, [learningGoals, selectedGoalId]);

  useEffect(() => {
    if (lectures.length > 0 && selectedLectureId === null) {
      setSelectedLectureId(lectures[0].id);
    }
  }, [lectures, selectedLectureId]);

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
      fetchLearningGoals();
      fetchDashboardData();
    } catch (e) {
      console.warn("Failed creating goal on server.");
      setShowGoalDialog(false);
    }
  }

  const selectedGoal = learningGoals.find(g => g.id === selectedGoalId) || learningGoals[0];
  const selectedLecture = lectures.find(l => l.id === selectedLectureId) || lectures[0];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Revision Center</h2>
          <p className="text-sm text-muted-foreground">SM-2 spaced repetition · Forgetting curve · Agent scheduling</p>
        </div>
        <div className="flex items-center gap-2">
          {flashcards.length > 0 && (
            <Badge variant="outline" className="text-[10px] text-[var(--neuro-rose)] border-[var(--neuro-rose)]/30 gap-1">
              <AlertTriangle className="size-3" /> {flashcards.length} Due Today
            </Badge>
          )}
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

      {/* Learning Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {learningGoals.map((goal) => (
          <Card 
            key={goal.id} 
            className={cn(
              "border-border/50 transition-all cursor-pointer hover:border-primary/40",
              selectedGoalId === goal.id && "border-primary/60 bg-primary/5"
            )}
            onClick={() => setSelectedGoalId(goal.id)}
          >
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
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGoalId(goal.id);
                  setActiveTab("roadmap");
                }}
              >
                View Roadmap
              </Button>
            </CardContent>
          </Card>
        ))}
        {learningGoals.length === 0 && (
          <div className="col-span-2 py-8 border border-dashed border-border/50 rounded-xl flex flex-col items-center justify-center text-center">
            <TrendingUp className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium">No Learning Goals Created Yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add a goal or ask the Voice Companion to set one.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="flashcards" className="gap-2">
                <BookOpen className="size-3.5" /> Flashcards
              </TabsTrigger>
              <TabsTrigger value="quiz" className="gap-2">
                <Brain className="size-3.5" /> Quiz
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-2">
                <FileText className="size-3.5" /> Study Notes
              </TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-2">
                <TrendingUp className="size-3.5" /> Roadmap
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
                  <CardDescription className="text-xs">Generated dynamically · Targets weakness vectors</CardDescription>
                </CardHeader>
                <CardContent>
                  <QuizViewer />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Lecture-Derived Revision Notes</CardTitle>
                  <CardDescription className="text-xs">Compiled automatically by Notes Agent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 items-center overflow-x-auto pb-2 border-b border-border/50">
                    {lectures.map((l) => (
                      <Button
                        key={l.id}
                        variant={selectedLectureId === l.id ? "secondary" : "ghost"}
                        size="sm"
                        className="text-xs shrink-0"
                        onClick={() => setSelectedLectureId(l.id)}
                      >
                        {l.title}
                      </Button>
                    ))}
                    {lectures.length === 0 && (
                      <p className="text-xs text-muted-foreground">No lecture logs found.</p>
                    )}
                  </div>
                  {selectedLecture ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-sm font-semibold">{selectedLecture.title}</h3>
                          <p className="text-xs text-muted-foreground">{selectedLecture.subject} · {selectedLecture.date}</p>
                        </div>
                        {selectedLecture.summary && (
                          <Badge variant="outline" className="text-[10px]">Summarized</Badge>
                        )}
                      </div>
                      {selectedLecture.summary && (
                        <div className="p-3 bg-muted/30 border border-border/40 rounded-lg">
                          <p className="text-xs font-semibold mb-1 text-primary">Summary Concept</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{selectedLecture.summary}</p>
                        </div>
                      )}
                      {selectedLecture.notes ? (
                        <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed space-y-2 whitespace-pre-wrap border-t border-border/30 pt-4">
                          {selectedLecture.notes}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No notes compiled for this lecture log.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">Select a lecture above to view revision notes.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roadmap">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Goal Milestones</CardTitle>
                  <CardDescription className="text-xs">Recommended path to achieve target</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedGoal ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-primary">{selectedGoal.title}</span>
                        <Badge className="text-[10px]">{selectedGoal.progress}% complete</Badge>
                      </div>
                      {selectedGoal.roadmapReport ? (
                        <div className="p-4 rounded-lg bg-muted/20 border border-border/40 text-xs whitespace-pre-wrap leading-relaxed">
                          {selectedGoal.roadmapReport}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground py-4 text-center">
                          Generating milestones...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground py-8 text-center">
                      Select or create a learning goal above to inspect roadmap.
                    </div>
                  )}
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
              {weakTopics.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">All topics secure.</p>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="size-4 text-primary" /> Review Schedule
              </CardTitle>
              <CardDescription className="text-xs">For active flashcard decks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {flashcards.length > 0 ? (
                [{ day: "Today", count: flashcards.length, urgent: true }].map((s, idx) => (
                  <div key={idx} className={cn("flex items-center justify-between p-2 rounded-lg border", s.urgent ? "border-[var(--neuro-rose)]/30 bg-[var(--neuro-rose)]/5" : "border-border/30 bg-muted/5")}>
                    <div className="flex items-center gap-2">
                      <Clock className="size-3 text-muted-foreground" />
                      <span className="text-xs font-medium">{s.day}</span>
                    </div>
                    <Badge variant="outline" className={cn("text-[9px]", s.urgent && "border-[var(--neuro-rose)]/40 text-[var(--neuro-rose)]")}>
                      {s.count} cards
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No flashcards due — record a lecture to generate cards.</p>
              )}
            </CardContent>
          </Card>

          {/* Agent Recommendations */}
          <Card className="border-[var(--neuro-cyan)]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="size-4 text-[var(--neuro-cyan)]" /> Agent Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-xs">
              {profile.recommendations && profile.recommendations.length > 0 ? (
                profile.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-2 bg-muted/30 border border-border/30 rounded flex items-start gap-2 leading-relaxed">
                    <CheckCircle className="size-3 text-[var(--neuro-cyan)] shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-2 p-2 bg-muted/30 border border-border/30 rounded">
                  <CheckCircle className="size-3 text-[var(--neuro-cyan)] shrink-0 mt-0.5" />
                  <span>Ask the Voice Companion to evaluate your progress to generate new insights.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
