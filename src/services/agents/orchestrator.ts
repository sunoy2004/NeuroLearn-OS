import type { VoiceCommand, VoiceIntent } from "@/types";

export interface AgentTask {
  agentType: AgentType;
  priority: "high" | "medium" | "low";
  payload: Record<string, unknown>;
  dependencies?: string[];
}

export type AgentType =
  | "tutor"
  | "quiz"
  | "lecture"
  | "analytics"
  | "planning"
  | "revision"
  | "flashcard";

export interface AgentResponse {
  success: boolean;
  data?: Record<string, unknown>;
  message: string;
  nextAction?: string;
  metadata?: Record<string, unknown>;
}

class MasterOrchestrator {
  private agents: Map<AgentType, Agent>;
  private executionHistory: Array<{
    taskId: string;
    agentType: AgentType;
    timestamp: number;
    success: boolean;
    duration: number;
  }> = [];

  constructor() {
    this.agents = new Map();
    this.initializeAgents();
  }

  private initializeAgents(): void {
    this.agents.set("tutor", new TutorAgent());
    this.agents.set("quiz", new QuizAgent());
    this.agents.set("lecture", new LectureAgent());
    this.agents.set("analytics", new AnalyticsAgent());
    this.agents.set("planning", new PlanningAgent());
    this.agents.set("revision", new RevisionAgent());
    this.agents.set("flashcard", new FlashcardAgent());
  }

  async routeCommand(command: VoiceCommand): Promise<AgentResponse> {
    const agentType = this.mapIntentToAgent(command.intent);

    if (!agentType) {
      return {
        success: false,
        message: `Unknown intent: ${command.intent}. Please rephrase your command.`,
      };
    }

    const agent = this.agents.get(agentType);
    if (!agent) {
      return {
        success: false,
        message: `Agent ${agentType} not available`,
      };
    }

    const task: AgentTask = {
      agentType,
      priority: this.getPriorityForIntent(command.intent),
      payload: {
        command: command.transcript,
        intent: command.intent,
        entities: command.entities,
        confidence: command.confidence,
        timestamp: command.timestamp,
      },
    };

    const startTime = Date.now();
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    try {
      const response = await agent.execute(task);

      this.executionHistory.push({
        taskId,
        agentType,
        timestamp: Date.now(),
        success: response.success,
        duration: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      this.executionHistory.push({
        taskId,
        agentType,
        timestamp: Date.now(),
        success: false,
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        message: `Failed to execute ${agentType} agent. ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private mapIntentToAgent(intent: VoiceIntent): AgentType | null {
    const mapping: Partial<Record<VoiceIntent, AgentType>> = {
      LECTURE_START: "lecture",
      LECTURE_STOP: "lecture",
      QUIZ_REQUEST: "quiz",
      TUTORING_REQUEST: "tutor",
      REVISION_START: "revision",
      ANALYTICS_QUERY: "analytics",
      FLASHCARD_CREATE: "flashcard",
      ROADMAP_CREATE: "planning",
      GOAL_SET: "planning",
      WEAK_AREAS_QUERY: "analytics",
      PROGRESS_QUERY: "analytics",
      EXPLANATION_REQUEST: "tutor",
    };

    return mapping[intent] || null;
  }

  private getPriorityForIntent(intent: VoiceIntent): "high" | "medium" | "low" {
    const highPriority: VoiceIntent[] = ["LECTURE_START", "LECTURE_STOP", "QUIZ_REQUEST"];
    const mediumPriority: VoiceIntent[] = ["TUTORING_REQUEST", "REVISION_START", "ANALYTICS_QUERY"];

    if (highPriority.includes(intent)) return "high";
    if (mediumPriority.includes(intent)) return "medium";
    return "low";
  }

  getExecutionHistory(limit: number = 10): typeof this.executionHistory {
    return this.executionHistory.slice(-limit);
  }

  getAgentStats(agentType: AgentType): {
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
  } | null {
    const agentHistory = this.executionHistory.filter((h) => h.agentType === agentType);

    if (agentHistory.length === 0) return null;

    const totalExecutions = agentHistory.length;
    const successfulExecutions = agentHistory.filter((h) => h.success).length;
    const successRate = successfulExecutions / totalExecutions;
    const avgDuration =
      agentHistory.reduce((sum, h) => sum + h.duration, 0) / totalExecutions;

    return { totalExecutions, successRate, avgDuration };
  }
}

abstract class Agent {
  abstract type: AgentType;
  abstract name: string;
  abstract description: string;

  abstract execute(task: AgentTask): Promise<AgentResponse>;
}

class TutorAgent extends Agent {
  type: AgentType = "tutor";
  name = "Adaptive Tutor";
  description = "Provides personalized tutoring and explanations";

  async execute(task: AgentTask): Promise<AgentResponse> {
    const { entities } = task.payload as { entities: Record<string, string> };
    const topic = entities.topic || entities.subject || "this concept";

    await this.simulateProcessing(1500);

    return {
      success: true,
      message: `I'll explain ${topic} based on your learning style. Let me retrieve your previous interactions and tailor this explanation for you.`,
      data: {
        topic,
        explanationStyle: "analogy-based",
        suggestedFollowUp: `Would you like me to generate practice questions on ${topic}?`,
      },
      nextAction: "offer_quiz",
    };
  }

  private async simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class QuizAgent extends Agent {
  type: AgentType = "quiz";
  name = "Quiz Intelligence";
  description = "Generates adaptive quizzes and evaluates spoken answers";

  async execute(task: AgentTask): Promise<AgentResponse> {
    const { entities } = task.payload as { entities: Record<string, string> };
    const topic = entities.topic || entities.subject || "general topics";

    await this.simulateProcessing(2000);

    return {
      success: true,
      message: `Starting adaptive quiz on ${topic}. I'll generate questions based on your weak areas and previous performance. Say "ready" when you want to begin.`,
      data: {
        topic,
        questionCount: 10,
        difficulty: "adaptive",
        format: "spoken",
      },
      nextAction: "start_quiz_session",
    };
  }

  private async simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class LectureAgent extends Agent {
  type: AgentType = "lecture";
  name = "Lecture Workflow";
  description = "Manages lecture recording and processing";

  async execute(task: AgentTask): Promise<AgentResponse> {
    const { intent, entities } = task.payload as {
      intent: VoiceIntent;
      entities: Record<string, string>;
    };

    if (intent === "LECTURE_START") {
      await this.simulateProcessing(800);

      return {
        success: true,
        message: `Recording started${entities.subject ? ` for ${entities.subject}` : ""}. I'll capture the lecture, transcribe it in real-time, and automatically generate flashcards when you're done.`,
        data: {
          sessionId: `lecture-${Date.now()}`,
          status: "recording",
          features: ["transcription", "concept_extraction", "flashcard_generation"],
        },
        nextAction: "monitor_lecture",
      };
    } else if (intent === "LECTURE_STOP") {
      await this.simulateProcessing(1000);

      return {
        success: true,
        message: "Recording stopped. Processing lecture content and generating study materials...",
        data: {
          status: "processing",
          outputs: ["transcript", "concept_map", "flashcards", "summary"],
        },
        nextAction: "show_lecture_summary",
      };
    }

    return {
      success: false,
      message: "Unknown lecture intent",
    };
  }

  private async simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class AnalyticsAgent extends Agent {
  type: AgentType = "analytics";
  name = "Learning Analytics";
  description = "Analyzes learning progress and provides insights";

  async execute(task: AgentTask): Promise<AgentResponse> {
    const { intent } = task.payload as { intent: VoiceIntent };

    await this.simulateProcessing(1200);

    if (intent === "WEAK_AREAS_QUERY") {
      return {
        success: true,
        message: `Your weak areas are: Deadlocks (35% mastery), BCNF Normalization (42%), and Query Optimization (48%). I recommend starting with Deadlocks as it's most urgent.`,
        data: {
          weakTopics: [
            { name: "Deadlocks", mastery: 35, daysUntilReview: 2 },
            { name: "BCNF Normalization", mastery: 42, daysUntilReview: 4 },
            { name: "Query Optimization", mastery: 48, daysUntilReview: 6 },
          ],
        },
        nextAction: "offer_weak_area_revision",
      };
    }

    return {
      success: true,
      message: `Your overall progress: 67% complete. You've mastered 24 concepts across 3 subjects. Your current streak is 12 days, and you're on track to reach your goal by the deadline.`,
      data: {
        overallProgress: 67,
        conceptsMastered: 24,
        currentStreak: 12,
        estimatedCompletion: "2 weeks",
      },
    };
  }

  private async simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class PlanningAgent extends Agent {
  type: AgentType = "planning";
  name = "Learning Planning";
  description = "Creates learning roadmaps and sets goals";

  async execute(task: AgentTask): Promise<AgentResponse> {
    const { intent, entities } = task.payload as {
      intent: VoiceIntent;
      entities: Record<string, string>;
    };

    await this.simulateProcessing(1800);

    if (intent === "ROADMAP_CREATE") {
      const subject = entities.subject || entities.goal || "your subject";
      return {
        success: true,
        message: `Created a learning roadmap for ${subject}. I've broken it down into 4 stages: Basics (5 concepts), Intermediate (8 concepts), Advanced (6 concepts), and Mastery (4 concepts). Estimated time: 3 weeks with daily 2-hour sessions.`,
        data: {
          subject,
          stages: 4,
          totalConcepts: 23,
          estimatedDuration: "3 weeks",
        },
      };
    }

    if (intent === "GOAL_SET") {
      const goal = entities.goal || "your goal";
      const timeline = entities.timeline || "4 weeks";
      return {
        success: true,
        message: `Goal set: "${goal}" with a timeline of ${timeline}. I've created a custom study plan with daily milestones and spaced repetition reminders.`,
        data: {
          goal,
          timeline,
          milestones: 12,
          reminders: "daily",
        },
      };
    }

    return {
      success: true,
      message: "I can help you create learning roadmaps or set study goals. What would you like to do?",
    };
  }

  private async simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class RevisionAgent extends Agent {
  type: AgentType = "revision";
  name = "Revision Orchestrator";
  description = "Manages revision sessions based on spaced repetition";

  async execute(_task: AgentTask): Promise<AgentResponse> {
    await this.simulateProcessing(1000);

    return {
      success: true,
      message: "Starting revision session. I've identified 8 concepts that need review today based on your retention curves. We'll focus on topics with the highest forgetting probability first.",
      data: {
        conceptsToReview: 8,
        method: "spaced_repetition",
        sessionDuration: "30 minutes",
      },
      nextAction: "start_revision",
    };
  }

  private async simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class FlashcardAgent extends Agent {
  type: AgentType = "flashcard";
  name = "Flashcard Generator";
  description = "Generates intelligent flashcards from content";

  async execute(_task: AgentTask): Promise<AgentResponse> {
    await this.simulateProcessing(1500);

    return {
      success: true,
      message: "Generated 15 flashcards from your recent lecture. Cards include definitions, concept relationships, and practice scenarios. They're now added to your spaced repetition queue.",
      data: {
        cardsGenerated: 15,
        categories: ["definition", "relationship", "application"],
        nextReviewDate: new Date(Date.now() + 86400000).toISOString(),
      },
    };
  }

  private async simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const masterOrchestrator = new MasterOrchestrator();

export function getAgentByType(type: AgentType): Agent | undefined {
  return masterOrchestrator["agents"].get(type);
}

export function getOrchestratorStats(): {
  totalExecutions: number;
  successRate: number;
  activeAgents: number;
} {
  const history = masterOrchestrator.getExecutionHistory(100);
  const totalExecutions = history.length;
  const successRate =
    totalExecutions > 0
      ? history.filter((h) => h.success).length / totalExecutions
      : 1;
  const activeAgents = masterOrchestrator["agents"].size;

  return { totalExecutions, successRate, activeAgents };
}
