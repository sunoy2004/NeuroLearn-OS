import type { AgentStatus } from "@/types";

export interface AgentRecord {
  agent_id: string;
  name: string;
  status: AgentStatus["status"];
  last_activity: number;
  current_task: string;
  progress: number;
  provider?: string;
  model?: string;
  streaming?: boolean;
  healthy?: boolean;
  apiConfigured?: boolean;
}

const AGENT_DEFINITIONS: Omit<AgentRecord, "status" | "last_activity" | "current_task" | "progress">[] = [
  { agent_id: "orchestrator", name: "Orchestrator Agent" },
  { agent_id: "lecture", name: "Lecture Agent" },
  { agent_id: "notes", name: "Notes Agent" },
  { agent_id: "flashcard", name: "Flashcard Agent" },
  { agent_id: "quiz", name: "Quiz Agent" },
  { agent_id: "tutor", name: "Tutor Agent" },
  { agent_id: "analytics", name: "Analytics Agent" },
  { agent_id: "knowledge-graph", name: "Knowledge Graph Agent" },
];

class AgentRegistry {
  private agents: Map<string, AgentRecord> = new Map();
  private listeners: Set<(agents: AgentRecord[]) => void> = new Set();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    AGENT_DEFINITIONS.forEach((def) => {
      this.agents.set(def.agent_id, {
        ...def,
        status: "idle",
        last_activity: Date.now(),
        current_task: "Standby",
        progress: 0,
        healthy: false,
        apiConfigured: false,
      });
    });
    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      this.agents.forEach((agent, id) => {
        if (agent.status === "complete" && now - agent.last_activity > 5000) {
          this.setAgent(id, { status: "idle", current_task: agent.healthy ? `Ready (${agent.provider}/${agent.model})` : "Disabled", progress: 0 });
        }
      });
    }, 2000);
  }

  getAll(): AgentRecord[] {
    return Array.from(this.agents.values());
  }

  getActiveCount(): number {
    return this.getAll().filter(
      (a) => a.healthy && (a.status === "active" || a.status === "processing")
    ).length;
  }

  getHealthyCount(): number {
    return this.getAll().filter((a) => a.healthy).length;
  }

  toAgentStatus(): AgentStatus[] {
    return this.getAll().map((a) => ({
      id: a.agent_id,
      name: a.name,
      status: a.status,
      task: a.current_task,
      progress: a.progress,
      provider: a.provider,
      model: a.model,
      streaming: a.streaming,
      healthy: a.healthy,
      apiConfigured: a.apiConfigured,
    }));
  }

  setAgentMeta(agentId: string, meta: Partial<Pick<AgentRecord, "provider" | "model" | "streaming" | "healthy" | "apiConfigured">>) {
    const existing = this.agents.get(agentId);
    if (!existing) return;
    this.agents.set(agentId, { ...existing, ...meta, last_activity: Date.now() });
    this.notify();
  }

  setAgent(
    agentId: string,
    update: Partial<Pick<AgentRecord, "status" | "current_task" | "progress">>
  ) {
    const existing = this.agents.get(agentId);
    if (!existing) return;
    const updated: AgentRecord = {
      ...existing,
      ...update,
      last_activity: Date.now(),
    };
    this.agents.set(agentId, updated);
    this.notify();
  }

  activate(agentId: string, task: string, progress = 50) {
    this.setAgent(agentId, { status: "active", current_task: task, progress });
  }

  processing(agentId: string, task: string, progress = 70) {
    this.setAgent(agentId, { status: "processing", current_task: task, progress });
  }

  complete(agentId: string, task: string) {
    this.setAgent(agentId, { status: "complete", current_task: task, progress: 100 });
  }

  idle(agentId: string, task = "Standby") {
    this.setAgent(agentId, { status: "idle", current_task: task, progress: 0 });
  }

  resolveAgentId(executedName: string): string {
    const n = executedName.toLowerCase();
    if (n.includes("lecture")) return "lecture";
    if (n.includes("flashcard")) return "flashcard";
    if (n.includes("quiz")) return "quiz";
    if (n.includes("tutor")) return "tutor";
    if (n.includes("notes") || n.includes("summary")) return "notes";
    if (n.includes("analytics")) return "analytics";
    if (n.includes("graph") || n.includes("knowledge")) return "knowledge-graph";
    if (n.includes("navigation")) return "orchestrator";
    return "orchestrator";
  }

  handleBackendRegistry(agents: Array<{
    agent_id: string;
    status: string;
    current_task?: string;
    provider?: string;
    model?: string;
    streaming?: boolean;
    enabled?: boolean;
    healthy?: boolean;
    api_configured?: boolean;
  }>) {
    agents.forEach((a) => {
      const id = a.agent_id === "knowledge_graph" ? "knowledge-graph" : a.agent_id;
      const status = (a.status === "active" ? "active" : a.status === "processing" ? "processing" : "idle") as AgentStatus["status"];
      this.setAgentMeta(id, {
        provider: a.provider,
        model: a.model,
        streaming: a.streaming,
        healthy: a.enabled ?? a.healthy,
        apiConfigured: a.api_configured,
      });
      this.setAgent(id, { status, current_task: a.current_task || "Standby" });
    });
  }

  subscribe(cb: (agents: AgentRecord[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.getAll());
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.getAll()));
  }
}

export const agentRegistry = new AgentRegistry();
