import { WebSocket } from "ws";
import type { SttProvider } from "./types.ts";

interface DeepgramMessage {
  type?: string; // "Results" | "SpeechStarted" | "UtteranceEnd" | ...
  is_final?: boolean;
  speech_final?: boolean;
  channel?: { alternatives?: { transcript?: string }[] };
}

/**
 * Streaming STT over Deepgram. Telnyx delivers mulaw 8kHz, which Deepgram ingests
 * natively — no transcoding. `vad_events` gives us `SpeechStarted` for barge-in;
 * finalized segments accumulate until `speech_final` (end of the caller's turn),
 * then emit as one utterance.
 */
export function deepgramStt(apiKey: string, model: string): SttProvider {
  return {
    open({ onFinal, onSpeechStarted }) {
      const params = new URLSearchParams({
        encoding: "mulaw",
        sample_rate: "8000",
        channels: "1",
        model,
        punctuate: "true",
        interim_results: "true",
        vad_events: "true",
        endpointing: "300",
      });
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
        headers: { Authorization: `Token ${apiKey}` },
      });
      const queue: Buffer[] = [];
      let ready = false;
      let utterance = "";

      ws.on("open", () => {
        ready = true;
        for (const b of queue) ws.send(b);
        queue.length = 0;
      });
      ws.on("message", (raw) => {
        let msg: DeepgramMessage;
        try {
          msg = JSON.parse(raw.toString()) as DeepgramMessage;
        } catch {
          return;
        }
        if (msg.type === "SpeechStarted") {
          onSpeechStarted?.();
          return;
        }
        const text = msg.channel?.alternatives?.[0]?.transcript?.trim();
        if (msg.is_final && text) utterance = utterance ? `${utterance} ${text}` : text;
        if (msg.speech_final && utterance) {
          onFinal(utterance);
          utterance = "";
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
