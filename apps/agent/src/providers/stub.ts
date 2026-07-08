import type { TransitionCandidate, Turn } from "@voxflow/flow";
import type { LlmProvider, Providers, SttProvider, TtsProvider } from "./types.ts";

/**
 * Zero-dependency stubs so `pnpm dev:agent` boots with no API keys and the
 * Telnyx <-> flow wiring can be exercised end to end. They do NOT do real
 * speech — swap in Deepgram / OpenAI / ElevenLabs for that. Kept deliberately
 * simple and obvious.
 */

// STT stub: real transcription needs a provider, so this only logs frame volume.
// A real SttProvider streams the mulaw to Deepgram and calls onFinal per utterance.
const stubStt: SttProvider = {
  open() {
    let frames = 0;
    return {
      push() {
        frames++;
      },
      close() {
        if (frames) console.log(`[stt:stub] dropped ${frames} audio frames (no STT provider configured)`);
      },
    };
  },
};

// LLM stub: echoes the active node's guidance and picks the first edge whose
// condition keyword appears in the last user turn (else stays).
const stubLlm: LlmProvider = {
  async reply({ system, history }) {
    const lastUser = [...history].reverse().find((t) => t.role === "user");
    const hint = system.split("\n").find(Boolean) ?? "Okay.";
    return lastUser ? `(${hint}) I heard: "${lastUser.text}"` : hint;
  },
  async resolveTransition({ history, candidates }: { history: Turn[]; candidates: TransitionCandidate[] }) {
    const lastUser = ([...history].reverse().find((t) => t.role === "user")?.text ?? "").toLowerCase();
    const match = candidates.find(
      (c) => c.condition && c.condition.toLowerCase().split(/\W+/).some((w) => w.length > 3 && lastUser.includes(w)),
    );
    return match?.edgeId ?? candidates.find((c) => !c.condition)?.edgeId ?? null;
  },
};

// TTS stub: emits a single 20ms mulaw silence frame so the send path is real.
const stubTts: TtsProvider = {
  async synthesize({ text, onFrame }) {
    console.log(`[tts:stub] would speak: ${text}`);
    onFrame(Buffer.alloc(160, 0xff).toString("base64")); // 20ms @ 8kHz mulaw silence
  },
};

export function stubProviders(): Providers {
  return { stt: stubStt, llm: stubLlm, tts: stubTts };
}
