import type { TransitionResolver, Turn } from "@voxflow/flow";

/**
 * The three swappable speech legs. Real implementations (Deepgram, OpenAI,
 * ElevenLabs) implement these; the stubs let the runtime boot with no keys.
 *
 * Two hooks make the conversation feel human:
 *  - STT `onSpeechStarted` fires the moment the caller starts talking → barge-in.
 *  - LLM `reply` streams tokens via `onDelta` and both reply + TTS take an
 *    `AbortSignal` so an interruption cancels them mid-flight.
 */

export interface SttProvider {
  open(handlers: { onFinal: (text: string) => void; onSpeechStarted?: () => void }): SttStream;
}
export interface SttStream {
  /** Feed one inbound audio frame (raw mulaw 8kHz bytes). */
  push(mulaw: Buffer): void;
  close(): void;
}

export interface LlmReplyInput {
  system: string;
  history: Turn[];
  /** Called with each token chunk as it streams in. */
  onDelta?: (chunk: string) => void;
  signal?: AbortSignal;
}
export interface LlmProvider {
  /** Generate the agent's reply, streaming via onDelta; resolves with full text. */
  reply(input: LlmReplyInput): Promise<string>;
  resolveTransition: TransitionResolver;
}

export interface TtsInput {
  text: string;
  voice: string;
  onFrame: (mulawB64: string) => void;
  signal?: AbortSignal;
}
export interface TtsProvider {
  synthesize(input: TtsInput): Promise<void>;
}

export interface Providers {
  stt: SttProvider;
  llm: LlmProvider;
  tts: TtsProvider;
}
