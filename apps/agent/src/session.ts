import { FlowSession, type Flow, type Turn } from "@voxflow/flow";
import type { Providers } from "./providers/types.ts";

export interface CallSession {
  /** Feed one inbound audio frame (raw mulaw 8kHz). */
  pushAudio(mulaw: Buffer): void;
  stop(): void;
}

/**
 * One live call. Wires the flow state machine to the speech providers:
 *
 *   caller audio ─▶ STT ─▶ (append user turn) ─▶ flow.advance()
 *                                                     │
 *                          reply for the active node ◀┘ ─▶ TTS ─▶ caller
 *
 * On reaching an `end` node it speaks the farewell and asks the transport to
 * hang up. Barge-in/interruption is intentionally left to a later pass.
 */
export function startCallSession(opts: {
  flow: Flow;
  providers: Providers;
  variables?: Record<string, string>;
  sendFrame: (mulawB64: string) => void;
  hangup: () => void;
}): CallSession {
  const { flow, providers, sendFrame, hangup } = opts;
  const session = new FlowSession(flow, { variables: opts.variables });
  const history: Turn[] = [];

  const speak = async (text: string): Promise<void> => {
    if (!text.trim()) return;
    history.push({ role: "assistant", text });
    await providers.tts.synthesize({ text, voice: flow.models.tts.voice, onFrame: sendFrame });
  };

  const onFinal = async (userText: string): Promise<void> => {
    if (!userText.trim()) return;
    history.push({ role: "user", text: userText });

    const result = await session.advance({ history, resolveTransition: providers.llm.resolveTransition });
    if (result.ended) {
      const bye = session.farewell();
      if (bye) await speak(bye);
      hangup();
      return;
    }
    const reply = await providers.llm.reply({ system: session.systemPrompt(), history });
    await speak(reply);
  };

  const stt = providers.stt.open({ onFinal: (t) => void onFinal(t) });

  // Kick off the call: greeting, then the opening line for the first node.
  void (async () => {
    const { greeting } = session.begin();
    if (greeting) await speak(greeting);
    if (session.isEnded) {
      hangup();
      return;
    }
    const opener = await providers.llm.reply({ system: session.systemPrompt(), history });
    await speak(opener);
  })();

  return {
    pushAudio: (mulaw) => stt.push(mulaw),
    stop: () => stt.close(),
  };
}
