import { KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setKey } from "./api";

export function ConnectCard({ onConnect }: { onConnect: () => void }) {
  const [draft, setDraft] = useState("");
  const connect = () => {
    if (!draft.trim()) return;
    setKey(draft);
    onConnect();
  };
  return (
    <div className="mx-auto mt-16 w-full max-w-md px-6">
      <Card>
        <CardHeader>
          <div className="bg-muted mb-1 flex size-10 items-center justify-center rounded-lg">
            <KeyRound className="size-5" />
          </div>
          <CardTitle>Connect Zernio</CardTitle>
          <CardDescription>
            Paste a Zernio API key to list your numbers and point them at this agent. The key is stored in your browser
            and sent only to the local proxy, never bundled.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            type="password"
            placeholder="zk_live_…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect()}
          />
          <Button onClick={connect} disabled={!draft.trim()}>
            Connect
          </Button>
          <a
            href="https://zernio.com/dashboard/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Get a key →
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
