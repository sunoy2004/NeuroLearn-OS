import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Network, Brain, Zap, Filter } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

function getMasteryColor(mastery: number) {
  if (mastery >= 80) return "var(--neuro-green)";
  if (mastery >= 65) return "var(--neuro-cyan)";
  if (mastery >= 50) return "var(--neuro-amber)";
  return "var(--neuro-rose)";
}

function GraphVisualization({ selectedId, onSelect, subjectFilter }: {
  selectedId: string | null; onSelect: (id: string) => void; subjectFilter: string;
}) {
  const { concepts } = useAppStore();
  const filtered = subjectFilter === "All" ? concepts : concepts.filter((c) => c.subject === subjectFilter);
  const visibleIds = new Set(filtered.map((c) => c.id));

  function getNodePos(id: string) {
    const idx = concepts.findIndex((c) => c.id === id);
    if (idx === -1) return { x: 430, y: 230 };
    const angle = (idx / Math.max(concepts.length, 1)) * 2 * Math.PI;
    const radius = 160;
    return {
      x: Math.round(430 + Math.cos(angle) * radius),
      y: Math.round(230 + Math.sin(angle) * radius),
    };
  }

  const edges: { from: string; to: string }[] = [];
  for (const c of filtered) {
    for (const conn of c.connections) {
      if (visibleIds.has(conn) && !edges.find((e) => (e.from === conn && e.to === c.id))) {
        edges.push({ from: c.id, to: conn });
      }
    }
  }

  return (
    <svg width="100%" viewBox="0 0 860 460" className="w-full" style={{ minHeight: 300 }}>
      <defs>
        {concepts.map((c) => (
          <radialGradient key={c.id} id={`grad-${c.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={getMasteryColor(c.mastery)} stopOpacity={0.3} />
            <stop offset="100%" stopColor={getMasteryColor(c.mastery)} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>

      {/* Edges */}
      {edges.map((edge, i) => {
        const from = getNodePos(edge.from);
        const to = getNodePos(edge.to);
        if (!from || !to) return null;
        return (
          <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke="oklch(0.22 0.02 240)" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6} />
        );
      })}

      {/* Nodes */}
      {filtered.map((c) => {
        const pos = getNodePos(c.id);
        if (!pos) return null;
        const color = getMasteryColor(c.mastery);
        const isSelected = selectedId === c.id;
        const r = isSelected ? 22 : 16;
        return (
          <g key={c.id} onClick={() => onSelect(c.id)} style={{ cursor: "pointer" }}>
            <circle cx={pos.x} cy={pos.y} r={r + 10} fill={`url(#grad-${c.id})`} />
            <circle cx={pos.x} cy={pos.y} r={r} fill="oklch(0.12 0.015 240)"
               stroke={color} strokeWidth={isSelected ? 2.5 : 1.5}
              filter={isSelected ? `drop-shadow(0 0 8px ${color})` : undefined} />
            <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={isSelected ? 8 : 7} fill={color} fontWeight={600}>
              {c.name.length > 10 ? c.name.slice(0, 9) + "…" : c.name}
            </text>
            <text x={pos.x} y={pos.y + 34} textAnchor="middle" fontSize={7} fill="oklch(0.52 0.02 240)">
              {c.mastery}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function KnowledgeGraph() {
  const { concepts, fetchConceptGraph } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("All");

  useEffect(() => {
    fetchConceptGraph();
  }, [fetchConceptGraph]);

  useEffect(() => {
    if (concepts.length > 0 && (selectedId === null || !concepts.some(c => c.id === selectedId))) {
      setSelectedId(concepts[0].id);
    }
  }, [concepts, selectedId]);

  const selected = concepts.find((c) => c.id === selectedId) || concepts[0];
  const connectedConcepts = selected ? concepts.filter((c) => selected.connections.includes(c.id)) : [];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Knowledge Graph</h2>
          <p className="text-sm text-muted-foreground">Semantic concept map · Qdrant vector store · {concepts.length} nodes</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] text-[var(--neuro-cyan)] border-[var(--neuro-cyan)]/30 gap-1">
            <Network className="size-3" /> Live Graph
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Filter:</span>
            {["All", "DBMS", "OS"].map((f) => (
              <Button key={f} variant={subjectFilter === f ? "default" : "outline"} size="sm"
                className={cn("h-7 text-xs", subjectFilter === f && "neuro-glow-sm")}
                onClick={() => setSubjectFilter(f)}>
                {f}
              </Button>
            ))}
          </div>

          {/* Graph */}
          <Card className="border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <div className="relative bg-[oklch(0.09_0.015_240)] rounded-lg overflow-hidden">
                <div className="absolute inset-0 neuro-grid-bg opacity-30 pointer-events-none" />
                <GraphVisualization selectedId={selectedId} onSelect={setSelectedId} subjectFilter={subjectFilter} />
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="font-medium">Mastery:</span>
            {[{ label: "≥80% Strong", color: "var(--neuro-green)" }, { label: "65-80% Good", color: "var(--neuro-cyan)" },
              { label: "50-65% Fair", color: "var(--neuro-amber)" }, { label: "<50% Weak", color: "var(--neuro-rose)" }].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full inline-block" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {selected && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">{selected.name}</CardTitle>
                  <Badge variant="outline" className="text-[9px] shrink-0">{selected.subject}</Badge>
                </div>
                <CardDescription className="text-xs">Last reviewed: {selected.lastReviewed}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Mastery</span>
                    <span className="font-semibold" style={{ color: getMasteryColor(selected.mastery) }}>{selected.mastery}%</span>
                  </div>
                  <Progress value={selected.mastery} className="h-1.5" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Retention</span>
                    <span className="font-semibold">{selected.retention}%</span>
                  </div>
                  <Progress value={selected.retention} className="h-1.5" />
                </div>
                {connectedConcepts.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Zap className="size-3" /> Connected Concepts
                    </p>
                    <div className="space-y-1.5">
                      {connectedConcepts.map((c) => (
                        <button key={c.id} onClick={() => setSelectedId(c.id)}
                          className="w-full flex items-center justify-between p-2 rounded-lg border border-border/40 hover:border-primary/30 bg-muted/10 hover:bg-muted/20 transition-all text-left">
                          <span className="text-xs font-medium">{c.name}</span>
                          <span className="text-[10px] font-semibold" style={{ color: getMasteryColor(c.mastery) }}>{c.mastery}%</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="size-4 text-primary" /> Graph Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Total Concepts", value: concepts.length, color: "text-primary" },
                { label: "Avg Mastery", value: `${concepts.length > 0 ? Math.round(concepts.reduce((s, c) => s + c.mastery, 0) / concepts.length) : 0}%`, color: "text-[var(--neuro-green)]" },
                { label: "At Risk", value: concepts.filter((c) => c.mastery < 50).length, color: "text-[var(--neuro-rose)]" },
                { label: "Total Edges", value: concepts.reduce((s, c) => s + c.connections.length, 0), color: "text-[var(--neuro-cyan)]" },
              ].map((s) => (
                <div key={s.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span className={cn("text-sm font-bold", s.color)}>{s.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full concept grid */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">All Concepts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {concepts.map((c) => (
              <button key={c.id} onClick={() => setSelectedId(c.id)}
                className={cn("p-3 rounded-lg border text-left transition-all", selectedId === c.id ? "border-primary/50 bg-primary/5" : "border-border/40 bg-muted/10 hover:border-primary/30 hover:bg-muted/20")}>
                <p className="text-xs font-medium mb-1 truncate">{c.name}</p>
                <Badge variant="outline" className="text-[8px] mb-2">{c.subject}</Badge>
                <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.mastery}%`, background: getMasteryColor(c.mastery) }} />
                </div>
                <p className="text-[10px] mt-1" style={{ color: getMasteryColor(c.mastery) }}>{c.mastery}%</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
