import {
  fetchAgentHealth,
  reloadAgentConfigs,
  applyHealthToCache,
  type AgentHealthRecord,
} from "@/config/agentConfigLoader";
import { agentRegistry } from "./agentRegistry";

export interface BootstrapResult {
  agents: AgentHealthRecord[];
  activeCount: number;
  healthy: boolean;
}

class AgentBootstrapService {
  private initialized = false;

  async initialize(): Promise<BootstrapResult> {
    const agents = await fetchAgentHealth(true);
    this.syncRegistry(agents);
    this.initialized = true;

    const activeCount = agents.filter((a) => a.enabled && a.healthy).length;
    console.log(`[AgentBootstrap] ${activeCount}/${agents.length} agents active`);

    agents.forEach((a) => {
      console.log(
        `[AgentBootstrap] ${a.display_name} | provider=${a.provider} | model=${a.model} | streaming=${a.streaming}`
      );
    });

    return { agents, activeCount, healthy: activeCount > 0 };
  }

  async reload(): Promise<BootstrapResult> {
    const agents = await reloadAgentConfigs();
    this.syncRegistry(agents);
    return {
      agents,
      activeCount: agents.filter((a) => a.enabled).length,
      healthy: true,
    };
  }

  syncFromWebSocket(agentHealth: AgentHealthRecord[]) {
    applyHealthToCache(agentHealth);
    this.syncRegistry(agentHealth);
  }

  private syncRegistry(agents: AgentHealthRecord[]) {
    agents.forEach((a) => {
      const id = a.agent_id;
      agentRegistry.setAgentMeta(id, {
        provider: a.provider,
        model: a.model,
        streaming: a.streaming,
        healthy: a.enabled && a.healthy,
        apiConfigured: a.api_configured,
      });
      if (!a.enabled) {
        agentRegistry.idle(id, "Disabled — missing API key");
      } else {
        agentRegistry.idle(id, `Ready (${a.provider}/${a.model})`);
      }
    });
  }

  isInitialized() {
    return this.initialized;
  }
}

export const agentBootstrap = new AgentBootstrapService();
