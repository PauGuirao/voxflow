import { WebSocketServer } from "ws";
import { loadFlow } from "./flow-store.ts";
import { buildProviders } from "./providers/index.ts";
import { startCallSession, type CallSession } from "./session.ts";

/**
 * Telnyx media-streaming frames (the shape Zernio's bridge speaks over the
 * wss:// forward). Only the fields we read are typed.
 */
interface MediaMessage {
  event?: string;
  stream_id?: string;
  start?: { stream_id?: string };
  media?: { payload?: string; track?: string };
}

/**
 * The wss:// endpoint a Zernio number's `forwardTo` points at. Each inbound
 * connection is one call; `?agentId=` selects the flow. On `start` we open a
 * CallSession; `media` frames feed STT; `stop`/close tears down.
 */
export function startServer(opts: { port: number }): WebSocketServer {
  const wss = new WebSocketServer({ port: opts.port });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const agentId = url.searchParams.get("agentId") ?? "sample";
    let streamId = "";
    let session: CallSession | null = null;

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
          const flow = await loadFlow(agentId);
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
          session?.stop();
          session = null;
          break;
        }
      }
    });

    ws.on("close", () => {
      session?.stop();
      session = null;
      console.log(`[agent] call ended agent=${agentId}`);
    });
  });

  console.log(`[agent] Voxflow runtime listening on ws://0.0.0.0:${opts.port}`);
  return wss;
}
