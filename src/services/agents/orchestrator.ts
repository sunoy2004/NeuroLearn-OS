import type { VoiceCommand, VoiceIntent } from "@/types";
import { apiRequest } from "../api";

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
  private agents: Map<AgentType, Agent> = new Map();
  private executionHistory: Array<{
    taskId: string;
    agentType: AgentType;
    timestamp: number;
    success: boolean;
    duration: number;
  }> = [];

  constructor() {
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
    const startTime = Date.now();
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    try {
      // 1. Try to process using production FastAPI agent server
      const result = await apiRequest<any>("/api/voice/process", {
        method: "POST",
        body: JSON.stringify({
          transcript: command.transcript,
          userId: command.userId || "demo-user"
        })
      });
      
      const agentType = this.mapIntentToAgent(result.intent) || "tutor";
      this.executionHistory.push({
        taskId,
        agentType,
        timestamp: Date.now(),
        success: true,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        message: result.response,
        nextAction: result.agentExecuted,
        data: {
          topic: result.entities.topic || result.entities.subject || "this concept",
          audioUrl: result.audioUrl
        }
      };
    } catch (error) {
      console.warn("FastAPI Orchestrator offline. Invoking client-side simulation fallback.", error);
      
      // 2. Client-side mock agents fallback
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
      } catch (err) {
        this.executionHistory.push({
          taskId,
          agentType,
          timestamp: Date.now(),
          success: false,
          duration: Date.now() - startTime,
        });
        return {
          success: false,
          message: `Failed to execute ${agentType} agent locally.`,
        };
      }
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
    return {
      success: true,
      message: `Local explanation: ${topic} is structured dynamically. To connect with a live orchestrator, ensure the FastAPI server is running on port 8000.`,
      data: { topic },
    };
  }
}

class QuizAgent extends Agent {
  type: AgentType = "quiz";
  name = "Quiz Intelligence";
  description = "Generates adaptive quizzes and evaluates spoken answers";
  async execute(task: AgentTask): Promise<AgentResponse> {
    const { entities } = task.payload as { entities: Record<string, string> };
    const topic = entities.topic || "DBMS";
    return {
      success: true,
      message: `Local quiz ready on ${topic}. Ensure backend server is active to trigger spoken hesitation scoring.`,
      data: { topic },
    };
  }
}

class LectureAgent extends Agent {
  type: AgentType = "lecture";
  name = "Lecture Workflow";
  description = "Manages lecture recording and processing";
  async execute(task: AgentTask): Promise<AgentResponse> {
    const { intent } = task.payload as { intent: VoiceIntent };
    return {
      success: true,
      message: intent === "LECTURE_START" ? "Recording started locally." : "Recording stopped locally.",
    };
  }
}

class AnalyticsAgent extends Agent {
  type: AgentType = "analytics";
  name = "Learning Analytics";
  description = "Analyzes learning progress and provides insights";
  async execute(): Promise<AgentResponse> {
    return { success: true, message: "Local stats retrieved." };
  }
}

class PlanningAgent extends Agent {
  type: AgentType = "planning";
  name = "Learning Planning";
  description = "Creates learning roadmaps and sets goals";
  async execute(): Promise<AgentResponse> {
    return { success: true, message: "Local goal plan set." };
  }
}

class RevisionAgent extends Agent {
  type: AgentType = "revision";
  name = "Revision Orchestrator";
  description = "Manages revision sessions based on spaced repetition";
  async execute(): Promise<AgentResponse> {
    return { success: true, message: "Local revision session scheduled." };
  }
}

class FlashcardAgent extends Agent {
  type: AgentType = "flashcard";
  name = "Flashcard Generator";
  description = "Generates intelligent flashcards from content";
  async execute(): Promise<AgentResponse> {
    return { success: true, message: "Local flashcard generator completed." };
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
