import { WebSocket } from "ws";
import type { SttProvider } from "./types.ts";

interface DeepgramMessage {
  is_final?: boolean;
  channel?: { alternatives?: { transcript?: string }[] };
}

/**
 * Streaming STT over Deepgram. Telnyx delivers mulaw 8kHz, which Deepgram
 * ingests natively (encoding=mulaw&sample_rate=8000) — no transcoding. Frames
 * that arrive before the socket opens are queued.
 */
export function deepgramStt(apiKey: string, model: string): SttProvider {
  return {
    open({ onFinal }) {
      const params = new URLSearchParams({
        encoding: "mulaw",
        sample_rate: "8000",
        channels: "1",
        model,
        punctuate: "true",
        interim_results: "false",
        endpointing: "300",
      });
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
        headers: { Authorization: `Token ${apiKey}` },
      });
      const queue: Buffer[] = [];
      let ready = false;

      ws.on("open", () => {
        ready = true;
        for (const b of queue) ws.send(b);
        queue.length = 0;
      });
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as DeepgramMessage;
          const text = msg.channel?.alternatives?.[0]?.transcript;
          if (msg.is_final && text) onFinal(text);
        } catch {
          // non-JSON keepalive
        }
      });
      ws.on("error", (e) => console.error("[stt:deepgram]", e instanceof Error ? e.message : e));

      return {
        push(mulaw) {
          if (ready) ws.send(mulaw);
          else queue.push(mulaw);
        },
        close() {
          try {
            if (ready) ws.send(JSON.stringify({ type: "CloseStream" }));
            ws.close();
          } catch {
            // already closed
          }
        },
      };
    },
  };
}
