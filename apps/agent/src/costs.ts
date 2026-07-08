import type { Flow } from "@voxflow/flow";

/**
 * Rough per-minute cost estimate per leg. Real provider pricing is per token /
 * per character; this is a duration-based approximation (like most dashboards)
 * — surfaced clearly as an estimate, not a bill. Zernio remains the source of
 * truth for the telephony charge.
 */
const STT_PER_MIN: Record<string, number> = { "nova-3": 0.0043, "nova-2": 0.0043, "nova-2-phonecall": 0.0043 };
const LLM_PER_MIN: Record<string, number> = { "gpt-4o-mini": 0.002, "gpt-4o": 0.03, "gpt-4.1-mini": 0.004, "gpt-4.1": 0.03 };
const TTS_PER_MIN: Record<string, number> = {
  eleven_turbo_v2_5: 0.06,
  eleven_flash_v2_5: 0.06,
  eleven_multilingual_v2: 0.18,
};

export interface CostBreakdown {
  stt: number;
  llm: number;
  tts: number;
  total: number;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function estimateCost(models: Flow["models"], durationSeconds: number): CostBreakdown {
  const min = durationSeconds / 60;
  const stt = min * (STT_PER_MIN[models.stt.model] ?? 0.0043);
  const llm = min * (LLM_PER_MIN[models.llm.model] ?? 0.005);
  const tts = min * (TTS_PER_MIN[models.tts.model] ?? 0.06);
  return { stt: round4(stt), llm: round4(llm), tts: round4(tts), total: round4(stt + llm + tts) };
}
