import { MessageCircle, Phone, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { assignAgent, listNumbers, type PhoneNumber } from "./api";

export function NumbersPanel({ agentId }: { agentId: string }) {
  const [numbers, setNumbers] = useState<PhoneNumber[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      setNumbers(await listNumbers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load numbers");
      setNumbers([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const assign = async (n: PhoneNumber, channel: "whatsapp" | "pstn") => {
    setBusy(`${n.id}:${channel}`);
    setError(null);
    try {
      await assignAgent({ phoneNumberId: n.id, accountId: n.accountId, agentId, channel });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Your numbers</h1>
          <p className="text-muted-foreground text-sm">Point a Zernio number at this agent, over WhatsApp or PSTN.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive mb-4 rounded-md px-3 py-2 text-sm">{error}</div>
      )}
      {numbers === null && <p className="text-muted-foreground text-sm">Loading…</p>}
      {numbers?.length === 0 && !error && <p className="text-muted-foreground text-sm">No numbers on this account yet.</p>}

      <div className="flex flex-col gap-3">
        {numbers?.map((n) => {
          const pointedHere = n.forwardTo?.includes(`agentId=${agentId}`) ?? false;
          return (
            <Card key={n.id}>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {n.phoneNumber}
                    {pointedHere && <Badge variant="secondary">this agent</Badge>}
                  </div>
                  <div className="text-muted-foreground mt-0.5 truncate text-xs">
                    {pointedHere
                      ? `▶ forwarding to "${agentId}"`
                      : n.forwardTo
                        ? `forwards to ${n.forwardTo}`
                        : "no agent assigned"}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" disabled={busy !== null} onClick={() => assign(n, "whatsapp")}>
                    <MessageCircle className="size-4" />
                    {busy === `${n.id}:whatsapp` ? "…" : "WhatsApp"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => assign(n, "pstn")}>
                    <Phone className="size-4" />
                    {busy === `${n.id}:pstn` ? "…" : "PSTN"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
