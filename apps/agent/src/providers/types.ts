import type { TransitionResolver, Turn } from "@voxflow/flow";

/**
 * The three swappable speech legs. Real implementations (Deepgram, OpenAI/
 * Anthropic, ElevenLabs) implement these; the stubs let the runtime boot with
 * no API keys so you can wire telephony first and add voice providers after.
 */

/** Streaming speech-to-text over the caller's audio (mulaw 8kHz frames). */
export interface SttProvider {
  open(handlers: { onFinal: (text: string) => void }): SttStream;
}
export interface SttStream {
  /** Feed one inbound audio frame (raw mulaw 8kHz bytes). */
  push(mulaw: Buffer): void;
  close(): void;
}

/** The reasoning leg: reply generation + which transition the graph should take. */
export interface LlmProvider {
  reply(input: { system: string; history: Turn[] }): Promise<string>;
  resolveTransition: TransitionResolver;
}

/** Text-to-speech → outbound audio, emitted as base64 mulaw 8kHz frames. */
export interface TtsProvider {
  synthesize(input: { text: string; voice: string; onFrame: (mulawB64: string) => void }): Promise<void>;
}

export interface Providers {
  stt: SttProvider;
  llm: LlmProvider;
  tts: TtsProvider;
}
