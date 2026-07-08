import type { Flow } from "@voxflow/flow";
import { WebSocketServer } from "ws";
import { estimateCost } from "./costs.ts";
import { loadFlow } from "./flow-store.ts";
import { buildProviders } from "./providers/index.ts";
import { startCallSession, type CallSession } from "./session.ts";

const API_BASE = process.env.VOXFLOW_API_BASE ?? "http://localhost:8788";

/**
 * Telnyx media-streaming frames (the shape Zernio's bridge speaks over the
 * wss:// forward). Only the fields we read are typed.
 */
interface MediaMessage {
  event?: string;
  stream_id?: string;
  start?: { stream_id?: string; from?: string; to?: string };
  media?: { payload?: string; track?: string };
}

/**
 * The wss:// endpoint a Zernio number's `forwardTo` points at. Each inbound
 * connection is one call; `?agentId=` selects the flow. On `start` we open a
 * CallSession; `media` frames feed STT; on hangup we log the call (transcript +
 * estimated cost) to the API so it shows up in the studio.
 */
export function startServer(opts: { port: number }): WebSocketServer {
  const wss = new WebSocketServer({ port: opts.port });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const agentId = url.searchParams.get("agentId") ?? "sample";
    let streamId = "";
    let session: CallSession | null = null;
    let models: Flow["models"] | null = null;
    let startedAt = 0;
    let from = "caller";
    let to = agentId;
    let logged = false;

    const sendFrame = (payload: string): void => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ event: "media", stream_id: streamId, media: { payload } }));
      }
    };

    // Barge-in: flush any audio we've buffered on the far side so the agent goes
    // silent the instant the caller starts talking.
    const clearAudio = (): void => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ event: "clear", stream_id: streamId }));
      }
    };

    const finalize = async (): Promise<void> => {
      if (logged || !session || !models || !startedAt) return;
      logged = true;
      const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      const transcript = session.transcript().map((t) => ({ role: t.role, text: t.text }));
      const cost = estimateCost(models, durationSeconds);
      try {
        await fetch(`${API_BASE}/api/call-logs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agentId, from, to, direction: "inbound", durationSeconds, cost, transcript }),
        });
      } catch {
        // API down — call log dropped
      }
    };

    ws.on("message", async (raw) => {
      let msg: MediaMessage;
      try {
        msg = JSON.parse(raw.toString()) as MediaMessage;
      } catch {
        return;
      }

      switch (msg.event) {
        case "start": {
          streamId = msg.stream_id ?? msg.start?.stream_id ?? "";
          from = msg.start?.from ?? "caller";
          to = msg.start?.to ?? agentId;
          startedAt = Date.now();
          const flow = await loadFlow(agentId);
          models = flow.models;
          session = startCallSession({
            flow,
            providers: await buildProviders(flow.models),
            sendFrame,
            clearAudio,
            hangup: () => ws.close(),
          });
          console.log(`[agent] call started agent=${agentId} stream=${streamId}`);
          break;
        }
        case "media": {
          const payload = msg.media?.payload;
          // Only transcribe the caller's track; our own TTS echoes back as outbound.
          if (session && typeof payload === "string" && msg.media?.track !== "outbound") {
            session.pushAudio(Buffer.from(payload, "base64"));
          }
          break;
        }
        case "stop": {
          await finalize();
          session?.stop();
          session = null;
          break;
        }
      }
    });

    ws.on("close", () => {
      void finalize();
      session?.stop();
      session = null;
      console.log(`[agent] call ended agent=${agentId}`);
    });
  });

  console.log(`[agent] Voxflow runtime listening on ws://0.0.0.0:${opts.port}`);
  return wss;
}
