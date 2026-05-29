export interface AgentLLMConfig {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  streaming: boolean;
}

export interface AgentHealthRecord {
  agent: string;
  agent_id: string;
  display_name: string;
  name: string;
  provider: string;
  model: string;
  temperature: number;
  streaming: boolean;
  enabled: boolean;
  healthy: boolean;
  api_configured: boolean;
  status: "active" | "disabled" | "idle";
}

const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_BASE || "http://localhost:8001";

let cachedHealth: AgentHealthRecord[] = [];
let lastFetch = 0;
const CACHE_TTL_MS = 30_000;

export async function fetchAgentHealth(force = false): Promise<AgentHealthRecord[]> {
  const now = Date.now();
  if (!force && cachedHealth.length && now - lastFetch < CACHE_TTL_MS) {
    return cachedHealth;
  }
  try {
    const res = await fetch(`${AGENT_API_BASE}/agents/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedHealth = data.agents || [];
    lastFetch = now;
    return cachedHealth;
  } catch (e) {
    console.warn("[AgentConfigLoader] Failed to fetch agent health:", e);
    return cachedHealth;
  }
}

export async function reloadAgentConfigs(): Promise<AgentHealthRecord[]> {
  try {
    const res = await fetch(`${AGENT_API_BASE}/agents/reload`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedHealth = data.agents || [];
    lastFetch = Date.now();
    return cachedHealth;
  } catch (e) {
    console.warn("[AgentConfigLoader] Reload failed:", e);
    return fetchAgentHealth(true);
  }
}

export function applyHealthToCache(agents: AgentHealthRecord[]) {
  cachedHealth = agents;
  lastFetch = Date.now();
}

export function getCachedAgentHealth(): AgentHealthRecord[] {
  return cachedHealth;
}

/** Build typed config from health record (no API key exposed) */
export function toAgentLLMConfig(health: AgentHealthRecord): AgentLLMConfig {
  return {
    provider: health.provider,
    apiKey: health.api_configured ? "[configured]" : "",
    model: health.model,
    temperature: health.temperature,
    streaming: health.streaming,
  };
}

export function validateAgentConfig(health: AgentHealthRecord): { valid: boolean; reason?: string } {
  if (!health.enabled) {
    return { valid: false, reason: `Missing API key for ${health.display_name}` };
  }
  if (!health.model) {
    return { valid: false, reason: `No model configured for ${health.display_name}` };
  }
  return { valid: true };
}
