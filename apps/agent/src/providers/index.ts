import type { Flow } from "@voxflow/flow";
import { deepgramStt } from "./deepgram.ts";
import { elevenLabsTts } from "./elevenlabs.ts";
import { openaiLlm } from "./openai.ts";
import { stubProviders } from "./stub.ts";
import type { Providers } from "./types.ts";

const API_BASE = process.env.VOXFLOW_API_BASE ?? "http://localhost:8788";

interface ResolvedKeys {
  deepgram?: string;
  openai?: string;
  elevenlabs?: string;
}

/**
 * Keys configured in the studio Settings (stored on the API) take precedence;
 * env vars are the fallback for self-hosters / CI. Fetched per call so a key
 * added in the UI takes effect on the next call with no runtime restart.
 */
async function resolveKeys(): Promise<ResolvedKeys> {
  let stored: ResolvedKeys = {};
  try {
    const res = await fetch(`${API_BASE}/api/provider-keys`, { cache: "no-store" });
    if (res.ok) stored = ((await res.json()) as { keys?: ResolvedKeys }).keys ?? {};
  } catch {
    // API down — fall back to env only
  }
  return {
    deepgram: stored.deepgram ?? process.env.DEEPGRAM_API_KEY,
    openai: stored.openai ?? process.env.OPENAI_API_KEY,
    elevenlabs: stored.elevenlabs ?? process.env.ELEVENLABS_API_KEY,
  };
}

/**
 * Assemble the three speech legs for a call. Each leg uses its real provider when
 * a key is configured (UI or env), and the stub otherwise — so the stack can come
 * up one key at a time.
 */
export async function buildProviders(models: Flow["models"]): Promise<Providers> {
  const stub = stubProviders();
  const keys = await resolveKeys();

  const providers: Providers = {
    stt: keys.deepgram ? deepgramStt(keys.deepgram, models.stt.model) : stub.stt,
    llm: keys.openai ? openaiLlm(keys.openai, models.llm.model) : stub.llm,
    tts: keys.elevenlabs ? elevenLabsTts(keys.elevenlabs, models.tts.model) : stub.tts,
  };

  console.log(
    `[providers] stt=${keys.deepgram ? "deepgram" : "stub"} llm=${keys.openai ? "openai" : "stub"} tts=${keys.elevenlabs ? "elevenlabs" : "stub"}`,
  );
  return providers;
}

export * from "./types.ts";
