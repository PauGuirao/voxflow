/** Options for the model/voice pickers. Voices match the name→id map the
 *  runtime's ElevenLabs provider understands (apps/agent/src/providers/elevenlabs.ts). */
export const STT_MODELS = ["nova-3", "nova-2", "nova-2-phonecall"] as const;
export const LLM_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"] as const;
export const TTS_MODELS = ["eleven_turbo_v2_5", "eleven_flash_v2_5", "eleven_multilingual_v2"] as const;
export const TTS_VOICES = ["Rachel", "Adam", "Bella", "Antoni"] as const;
