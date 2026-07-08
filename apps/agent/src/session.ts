import { FlowSession, type Flow, type Turn } from "@voxflow/flow";
import type { Providers } from "./providers/types.ts";

export interface CallSession {
  /** Feed one inbound audio frame (raw mulaw 8kHz). */
  pushAudio(mulaw: Buffer): void;
  /** The conversation so far (for the call log on hangup). */
  transcript(): Turn[];
  stop(): void;
}

/**
 * One live call. Wires the flow state machine to the speech providers, with two
 * things that make it feel human:
 *
 *  - Streaming: the LLM reply streams token-by-token; complete sentences are
 *    sent to TTS as they land (chained so audio stays ordered), so the agent
 *    starts talking ~1 sentence in instead of after the whole reply.
 *  - Barge-in: when Deepgram reports the caller started speaking while the agent
 *    is talking, we abort the in-flight LLM + TTS and flush the caller's buffered
 *    audio (Telnyx `clear`), so the agent shuts up instantly.
 */
export function startCallSession(opts: {
  flow: Flow;
  providers: Providers;
  variables?: Record<string, string>;
  sendFrame: (mulawB64: string) => void;
  clearAudio: () => void;
  hangup: () => void;
}): CallSession {
  const { flow, providers, sendFrame, clearAudio, hangup } = opts;
  const session = new FlowSession(flow, { variables: opts.variables });
  const history: Turn[] = [];
  const voice = flow.models.tts.voice;

  let speaking = false;
  let ac: AbortController | null = null;

  /** Stop whatever the agent is currently saying and flush queued audio. */
  const bargeIn = (): void => {
    if (!speaking) return;
    ac?.abort();
    clearAudio();
    speaking = false;
  };

  /** Speak a fixed string (greeting / farewell) — abortable, ordered. */
  const speakText = async (text: string): Promise<void> => {
    if (!text.trim()) return;
    const controller = new AbortController();
    ac = controller;
    speaking = true;
    history.push({ role: "assistant", text });
    try {
      await providers.tts.synthesize({
        text,
        voice,
        onFrame: (f) => !controller.signal.aborted && sendFrame(f),
        signal: controller.signal,
      });
    } catch {
      // aborted / provider error
    }
    if (ac === controller) speaking = false;
  };

  /** Generate + speak a reply, streaming sentence-by-sentence. */
  const respond = async (): Promise<void> => {
    bargeIn();
    const controller = new AbortController();
    ac = controller;
    const signal = controller.signal;
    speaking = true;

    let tail = Promise.resolve();
    const speak = (sentence: string): void => {
      tail = tail.then(async () => {
        if (signal.aborted || !sentence.trim()) return;
        try {
          await providers.tts.synthesize({
            text: sentence,
            voice,
            onFrame: (f) => !signal.aborted && sendFrame(f),
            signal,
          });
        } catch {
          // aborted / provider error
        }
      });
    };

    let buffer = "";
    let full = "";
    try {
      full = await providers.llm.reply({
        system: session.systemPrompt(),
        history,
        signal,
        onDelta: (chunk) => {
          buffer += chunk;
          // Emit each complete sentence as soon as punctuation + whitespace lands.
          let m: RegExpMatchArray | null;
          while ((m = buffer.match(/^([\s\S]+?[.!?…]+)\s+/)) !== null) {
            speak(m[1]!.trim());
            buffer = buffer.slice(m[0].length);
          }
        },
      });
    } catch {
      // aborted / error
    }
    if (buffer.trim()) speak(buffer.trim());
    await tail;

    if (!signal.aborted) history.push({ role: "assistant", text: full });
    if (ac === controller) speaking = false;
  };

  const onFinal = async (text: string): Promise<void> => {
    if (!text.trim()) return;
    bargeIn();
    history.push({ role: "user", text });
    const result = await session.advance({ history, resolveTransition: providers.llm.resolveTransition });
    if (result.ended) {
      await speakText(session.farewell());
      hangup();
      return;
    }
    await respond();
  };

  const stt = providers.stt.open({
    onFinal: (t) => void onFinal(t),
    onSpeechStarted: () => bargeIn(),
  });

  // Kick off: greeting, then the opening line for the first node.
  void (async () => {
    const { greeting } = session.begin();
    if (greeting) await speakText(greeting);
    if (session.isEnded) {
      hangup();
      return;
    }
    await respond();
  })();

  return {
    pushAudio: (mulaw) => stt.push(mulaw),
    transcript: () => history,
    stop: () => stt.close(),
  };
}
