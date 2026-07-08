import type { TtsProvider } from "./types.ts";

// Common ElevenLabs voices by name → id, so a flow can say "Rachel" instead of a
// raw id. Names that look like ids pass through; otherwise default to Rachel.
const VOICE_IDS: Record<string, string> = {
  Rachel: "21m00Tcm4TlvDq8ikWAM",
  Adam: "pNInz6obpgDQGcFmaJgB",
  Bella: "EXAVITQu4vr4xnSDxMaL",
  Antoni: "ErXwobaYiN019PkySvjV",
};
const DEFAULT_VOICE = VOICE_IDS.Rachel!;

function resolveVoiceId(voice: string): string {
  if (VOICE_IDS[voice]) return VOICE_IDS[voice]!;
  return /^[A-Za-z0-9]{20}$/.test(voice) ? voice : DEFAULT_VOICE;
}

/**
 * ElevenLabs streaming TTS. `output_format=ulaw_8000` returns Telnyx's wire format
 * directly (mulaw 8kHz) — no transcoding — re-chunked into 160-byte (20ms) frames.
 * The AbortSignal lets barge-in stop synthesis + the request mid-stream.
 */
export function elevenLabsTts(apiKey: string, model: string): TtsProvider {
  return {
    async synthesize({ text, voice, onFrame, signal }) {
      if (signal?.aborted) return;
      const voiceId = resolveVoiceId(voice);
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify({ text, model_id: model }),
          signal,
        },
      );
      if (!res.ok || !res.body) throw new Error(`ElevenLabs ${res.status}: ${await res.text().catch(() => "")}`);

      const reader = res.body.getReader();
      let buf = Buffer.alloc(0);
      for (;;) {
        if (signal?.aborted) {
          await reader.cancel().catch(() => {});
          return;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buf = Buffer.concat([buf, Buffer.from(value)]);
        while (buf.length >= 160) {
          if (signal?.aborted) return;
          onFrame(buf.subarray(0, 160).toString("base64"));
          buf = buf.subarray(160);
        }
      }
      if (buf.length && !signal?.aborted) onFrame(buf.toString("base64"));
    },
  };
}
