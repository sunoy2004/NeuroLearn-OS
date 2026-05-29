import type { AgentLLMConfig, LLMProvider } from "./interfaces/llm";
import { GrokProvider } from "./grok/GrokProvider";
import { fetchAgentHealth, toAgentLLMConfig, type AgentHealthRecord } from "@/config/agentConfigLoader";

const providerCache = new Map<string, LLMProvider>();

export class AgentProviderFactory {
  static async create(agentId: string): Promise<LLMProvider> {
    if (providerCache.has(agentId)) {
      return providerCache.get(agentId)!;
    }

    const healthList = await fetchAgentHealth();
    const health = healthList.find(
      (a) => a.agent_id === agentId || a.agent === agentId
    );

    if (!health || !health.enabled) {
      const disabled: AgentLLMConfig = {
        provider: "disabled",
        apiKey: "",
        model: "—",
        temperature: 0,
        streaming: false,
      };
      const provider = new GrokProvider(disabled, agentId);
      providerCache.set(agentId, provider);
      return provider;
    }

    const config = toAgentLLMConfig(health);
    let provider: LLMProvider;

    switch (health.provider.toLowerCase()) {
      case "grok":
      case "groq":
        provider = new GrokProvider(config, agentId);
        break;
      default:
        provider = new GrokProvider(config, agentId);
    }

    providerCache.set(agentId, provider);
    return provider;
  }

  static clearCache(agentId?: string) {
    if (agentId) providerCache.delete(agentId);
    else providerCache.clear();
  }

  static fromHealth(health: AgentHealthRecord): LLMProvider {
    const config = toAgentLLMConfig(health);
    return new GrokProvider(config, health.agent_id);
  }
}
