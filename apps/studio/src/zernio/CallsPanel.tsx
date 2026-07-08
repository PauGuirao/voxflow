import { MessageCircle, Phone, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type CallRecord, listCalls } from "./api";

function fmtDuration(s: number | null): string {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function CallsPanel() {
  const [calls, setCalls] = useState<CallRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      setCalls(await listCalls());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calls");
      setCalls([]);
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
          <p className="text-muted-foreground text-sm">Recent calls handled on your Zernio numbers, with cost.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {error && <div className="bg-destructive/10 text-destructive mb-4 rounded-md px-3 py-2 text-sm">{error}</div>}
      {calls === null && <p className="text-muted-foreground text-sm">Loading…</p>}
      {calls?.length === 0 && !error && <p className="text-muted-foreground text-sm">No calls yet.</p>}

      <div className="flex flex-col gap-2">
        {calls?.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between gap-4 py-0">
              <div className="flex items-center gap-3">
                {c.channel === "whatsapp" ? (
                  <MessageCircle className="text-muted-foreground size-4" />
                ) : (
                  <Phone className="text-muted-foreground size-4" />
                )}
                <div>
                  <div className="text-sm font-medium">
                    {c.from} → {c.to}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {c.direction} · {new Date(c.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs tabular-nums">{fmtDuration(c.durationSeconds)}</span>
                <Badge variant={c.status === "ended" ? "secondary" : "outline"}>{c.status}</Badge>
                <span className="w-16 text-right text-sm tabular-nums">
                  ${(c.billableCostUSD ?? 0).toFixed(4)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
