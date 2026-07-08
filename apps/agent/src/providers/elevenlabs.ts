import type { TtsProvider } from "./types.ts";

// A few common ElevenLabs voices by name → id, so a flow can say "Rachel" instead
// of a raw id. Unknown names that look like ids pass through; otherwise default.
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
 * ElevenLabs streaming TTS. We request `output_format=ulaw_8000` so the bytes
 * come back already in Telnyx's wire format (mulaw 8kHz) — no transcoding. The
 * stream is re-chunked into 160-byte (20ms) frames the media socket expects.
 */
export function elevenLabsTts(apiKey: string, model: string): TtsProvider {
  return {
    async synthesize({ text, voice, onFrame }) {
      const voiceId = resolveVoiceId(voice);
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify({ text, model_id: model }),
        },
      );
      if (!res.ok || !res.body) throw new Error(`ElevenLabs ${res.status}: ${await res.text().catch(() => "")}`);

      const reader = res.body.getReader();
      let buf = Buffer.alloc(0);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf = Buffer.concat([buf, Buffer.from(value)]);
        while (buf.length >= 160) {
          onFrame(buf.subarray(0, 160).toString("base64"));
          buf = buf.subarray(160);
        }
      }
      if (buf.length) onFrame(buf.toString("base64"));
    },
  };
}
