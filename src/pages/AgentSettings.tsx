import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, RefreshCw, CheckCircle, XCircle, Zap, Cpu } from "lucide-react";
import { type AgentHealthRecord } from "@/config/agentConfigLoader";
import { agentBootstrap } from "@/agents/bootstrap";
import { PageShell } from "@/components/PageShell";
import { cn } from "@/lib/utils";

function AgentConfigRow({ agent }: { agent: AgentHealthRecord }) {
  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border transition-colors",
      agent.enabled ? "border-border/50 bg-muted/10" : "border-[var(--neuro-rose)]/30 bg-[var(--neuro-rose)]/5 opacity-80"
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="size-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">{agent.display_name || agent.name}</span>
          {agent.enabled ? (
            <Badge variant="outline" className="text-[9px] text-[var(--neuro-green)] border-[var(--neuro-green)]/30">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] text-[var(--neuro-rose)] border-[var(--neuro-rose)]/30">Disabled</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Provider: <strong className="text-foreground">{agent.provider}</strong></span>
          <span>Model: <strong className="text-foreground">{agent.model}</strong></span>
          <span>Temp: {agent.temperature}</span>
          <span>Streaming: {agent.streaming ? "On" : "Off"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {agent.api_configured ? (
          <span className="flex items-center gap-1 text-xs text-[var(--neuro-green)]">
            <CheckCircle className="size-3.5" /> API configured
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-[var(--neuro-rose)]">
            <XCircle className="size-3.5" /> No API key
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentSettings() {
  const [agents, setAgents] = useState<AgentHealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await agentBootstrap.initialize();
    setAgents(result.agents);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleReload = async () => {
    setReloading(true);
    const result = await agentBootstrap.reload();
    setAgents(result.agents);
    setReloading(false);
  };

  const activeCount = agents.filter((a) => a.enabled).length;

  return (
    <PageShell narrow>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
            <Settings className="size-5 shrink-0 text-primary" /> Agent Configuration
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Distributed LLM settings — each agent has isolated provider, model, and API key
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReload} disabled={reloading} className="w-full gap-2 sm:w-auto">
          <RefreshCw className={cn("size-3.5", reloading && "animate-spin")} />
          Reload Config
        </Button>
      </div>

      <Card className="border-[var(--neuro-cyan)]/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="size-4 text-[var(--neuro-cyan)]" />
            Agent Network Status
          </CardTitle>
          <CardDescription className="text-xs">
            {activeCount} of {agents.length} agents active with configured API keys
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            API keys are configured in <code className="text-primary">.env</code> per agent (e.g. <code>TUTOR_AGENT_API_KEY</code>).
            Keys are never exposed in the UI.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading agent configurations...</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Agent service offline — start <code>python -m agent_service.main</code> on port 8001
          </p>
        ) : (
          agents.map((agent) => (
            <AgentConfigRow key={agent.agent_id} agent={agent} />
          ))
        )}
      </div>
    </PageShell>
  );
}
