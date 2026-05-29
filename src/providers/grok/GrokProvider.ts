import type { AgentLLMConfig, LLMProvider } from "../interfaces/llm";

const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_BASE || "http://localhost:8001";

/**
 * Client-side Grok/Groq provider — proxies through agent_service.
 * LLM execution happens on the backend; this handles config display and health checks.
 */
export class GrokProvider implements LLMProvider {
  private config: AgentLLMConfig;
  private agentId: string;

  constructor(config: AgentLLMConfig, agentId = "global") {
    this.config = config;
    this.agentId = agentId;
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const res = await fetch(`${AGENT_API_BASE}/agents/health`);
    if (!res.ok) return `[${this.agentId}] Agent service offline`;
    return `[${this.agentId}] Use voice/text commands — LLM runs on agent service (${this.config.model})`;
  }

  async *stream(messages: Array<{ role: string; content: string }>): AsyncGenerator<string> {
    yield `[${this.agentId}] Streaming via WebSocket agent service`;
  }

  async summarize(text: string) {
    return { title: "Summary", summary: text.slice(0, 200), concepts: [] };
  }

  async embeddings(text: string): Promise<number[]> {
    return Array(1536).fill(0);
  }

  getConfig(): AgentLLMConfig {
    return this.config;
  }
}
