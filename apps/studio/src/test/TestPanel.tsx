import { Mic, PhoneOff, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { startVoiceTest, type VoiceStatus, type VoiceTest } from "./voiceClient";

const AGENT_WSS = import.meta.env.VITE_AGENT_WSS ?? "ws://localhost:8787";

const LABEL: Record<VoiceStatus, string> = {
  connecting: "Connecting…",
  listening: "Listening — start talking",
  ended: "Call ended",
  error: "Couldn't reach the agent runtime",
  "mic-denied": "Microphone permission denied",
};

export function TestPanel({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [status, setStatus] = useState<VoiceStatus | "idle">("idle");
  const [level, setLevel] = useState(0);
  const testRef = useRef<VoiceTest | null>(null);

  const start = () => {
    setStatus("connecting");
    testRef.current = startVoiceTest({
      wsUrl: `${AGENT_WSS}/?agentId=${encodeURIComponent(agentId)}`,
      onStatus: setStatus,
      onLevel: setLevel,
    });
  };
  const stop = () => {
    testRef.current?.stop();
    testRef.current = null;
    setLevel(0);
  };

  useEffect(() => () => testRef.current?.stop(), []);

  const active = status === "connecting" || status === "listening";
  const scale = 1 + Math.min(level * 3, 1);

  return (
    <aside className="bg-card flex w-80 shrink-0 flex-col gap-4 border-l p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Test call</h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => {
            stop();
            onClose();
          }}
        >
          <X className="size-4" />
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        Talk to this agent from your browser, the same media pipeline a real call uses (STT → LLM → TTS). Needs the
        provider keys set in Settings.
      </p>

      <div className="flex flex-col items-center gap-3 py-6">
        <div
          className={`flex size-20 items-center justify-center rounded-full transition-transform ${
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
          style={{ transform: active ? `scale(${scale})` : undefined }}
        >
          <Mic className="size-7" />
        </div>
        <span className="text-muted-foreground text-sm">{status === "idle" ? "Ready" : LABEL[status]}</span>
      </div>

      {active ? (
        <Button variant="destructive" onClick={stop}>
          <PhoneOff className="size-4" /> End test
        </Button>
      ) : (
        <Button onClick={start}>
          <Play className="size-4" /> Start test call
        </Button>
      )}
      <p className="text-muted-foreground text-center text-[11px]">Agent runtime: {AGENT_WSS}</p>
    </aside>
  );
}
