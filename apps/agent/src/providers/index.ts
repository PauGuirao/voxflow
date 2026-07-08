import type { Flow } from "@voxflow/flow";
import { deepgramStt } from "./deepgram.ts";
import { elevenLabsTts } from "./elevenlabs.ts";
import { openaiLlm } from "./openai.ts";
import { stubProviders } from "./stub.ts";
import type { Providers } from "./types.ts";

/**
 * Assemble the three speech legs for a call. Each leg uses its real provider when
 * that provider's API key is present, and falls back to the stub otherwise — so
 * you can bring the stack up one key at a time (e.g. TTS working before STT).
 */
export function buildProviders(models: Flow["models"]): Providers {
  const stub = stubProviders();
  const dg = process.env.DEEPGRAM_API_KEY;
  const oa = process.env.OPENAI_API_KEY;
  const el = process.env.ELEVENLABS_API_KEY;

  const providers: Providers = {
    stt: dg ? deepgramStt(dg, models.stt.model) : stub.stt,
    llm: oa ? openaiLlm(oa, models.llm.model) : stub.llm,
    tts: el ? elevenLabsTts(el, models.tts.model) : stub.tts,
  };

  console.log(
    `[providers] stt=${dg ? "deepgram" : "stub"} llm=${oa ? "openai" : "stub"} tts=${el ? "elevenlabs" : "stub"}`,
  );
  return providers;
}

export * from "./types.ts";
