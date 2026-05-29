export interface QuizAttempt {
  questionId: string;
  topic: string;
  selectedAnswer: number;
  correct: boolean;
  timestamp: number;
}

const STORAGE_KEY = "neurolearn_quiz_attempts";

class QuizStore {
  private attempts: QuizAttempt[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.attempts = JSON.parse(raw);
    } catch {
      this.attempts = [];
    }
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.attempts));
  }

  recordAttempt(questionId: string, topic: string, selectedAnswer: number, correctAnswer: number) {
    const attempt: QuizAttempt = {
      questionId,
      topic,
      selectedAnswer,
      correct: selectedAnswer === correctAnswer,
      timestamp: Date.now(),
    };
    this.attempts.push(attempt);
    this.persist();
    return attempt;
  }

  getAttempts(topic?: string): QuizAttempt[] {
    if (!topic) return this.attempts;
    return this.attempts.filter((a) => a.topic.toLowerCase().includes(topic.toLowerCase()));
  }

  getAccuracy(topic?: string): number {
    const relevant = this.getAttempts(topic);
    if (!relevant.length) return 0;
    return Math.round((relevant.filter((a) => a.correct).length / relevant.length) * 100);
  }

  getWeakTopics(): string[] {
    const byTopic: Record<string, { total: number; wrong: number }> = {};
    this.attempts.forEach((a) => {
      if (!byTopic[a.topic]) byTopic[a.topic] = { total: 0, wrong: 0 };
      byTopic[a.topic].total++;
      if (!a.correct) byTopic[a.topic].wrong++;
    });
    return Object.entries(byTopic)
      .filter(([, v]) => v.wrong / v.total > 0.4)
      .map(([topic]) => topic);
  }
}

export const quizStore = new QuizStore();
