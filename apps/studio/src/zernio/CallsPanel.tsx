import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type CallLog, listCallLogs } from "@/sessions/api";

function fmtDuration(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function agentName(id: string, names: Map<string, string>): string {
  return names.get(id) ?? id;
}

export function CallsPanel({ agentNames }: { agentNames: Map<string, string> }) {
  const [logs, setLogs] = useState<CallLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      setLogs(await listCallLogs());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calls");
      setLogs([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Calls</h1>
          <p className="text-muted-foreground text-sm">Every call your agents handled — transcript and estimated cost.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {error && <div className="bg-destructive/10 text-destructive mb-4 rounded-md px-3 py-2 text-sm">{error}</div>}
      {logs === null && <p className="text-muted-foreground text-sm">Loading…</p>}
      {logs?.length === 0 && !error && (
        <p className="text-muted-foreground text-sm">No calls yet. Place a Test call or point a number at an agent.</p>
      )}

      <div className="flex flex-col gap-2">
        {logs?.map((c) => {
          const expanded = open === c.id;
          return (
            <Card key={c.id}>
              <CardContent className="py-0">
                <button
                  className="flex w-full items-center justify-between gap-4 text-left"
                  onClick={() => setOpen(expanded ? null : c.id)}
                >
                  <div className="flex items-center gap-2">
                    {expanded ? (
                      <ChevronDown className="text-muted-foreground size-4" />
                    ) : (
                      <ChevronRight className="text-muted-foreground size-4" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{agentName(c.agentId, agentNames)}</div>
                      <div className="text-muted-foreground text-xs">
                        {c.from} → {c.to} · {new Date(c.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs tabular-nums">{fmtDuration(c.durationSeconds)}</span>
                    <Badge variant="secondary">~${c.cost.total.toFixed(4)}</Badge>
                  </div>
                </button>

                {expanded && (
                  <div className="mt-3 flex flex-col gap-2 border-t pt-3">
                    {c.transcript.length === 0 && <p className="text-muted-foreground text-xs">No transcript captured.</p>}
                    {c.transcript.map((t, i) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <span
                          className={`shrink-0 text-xs font-semibold ${t.role === "user" ? "text-blue-600" : "text-emerald-600"}`}
                        >
                          {t.role === "user" ? "Caller" : "Agent"}
                        </span>
                        <span className="text-foreground/90">{t.text}</span>
                      </div>
                    ))}
                    <div className="text-muted-foreground mt-1 text-[11px]">
                      est. cost — stt ${c.cost.stt.toFixed(4)} · llm ${c.cost.llm.toFixed(4)} · tts ${c.cost.tts.toFixed(4)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
