# Voxflow

**Open-source visual builder for AI voice agents, running on the [Zernio](https://zernio.com) telephony API.**

Design an agent as a graph of nodes on a canvas, point a phone number at it, and it answers calls, over **PSTN _and_ WhatsApp**. Voxflow brings no telephony of its own: Zernio handles number provisioning, call bridging, recording, transcription, and usage billing. Voxflow is the brain and the builder.

> Most open-source voice-agent platforms are phone-only and stop at *displaying* a cost estimate. Voxflow rides Zernio, so it also answers **WhatsApp calls** and every minute is **actually metered and billed** through Zernio's existing pipeline.

## How it works

```
 Caller ─▶ Zernio number (PSTN or WhatsApp)
              │  forwardTo = wss://your-agent/?agentId=…
              ▼
    Zernio media-streaming bridge  ──audio──▶  @voxflow/agent (this repo)
                                                   │
                              STT ─▶ flow.advance() ─▶ LLM ─▶ TTS
                                                   │
              ◀───────────────audio───────────────┘
```

Assigning an agent to a number just sets that number's **`forwardTo`** to the agent runtime's public `wss://` URL. When a call comes in, Zernio streams the live audio to the runtime; the runtime walks the flow graph (STT → decide → reply → TTS) and streams speech back. That `wss://` path is the same one Zernio already uses in production to bridge calls to customer AI agents.

## Monorepo

| Package | What it is |
|---|---|
| `packages/flow` | The conversation **graph schema + executor** — a runtime-agnostic state machine (zero deps beyond zod). The heart of the project. |
| `packages/zernio` | Typed **Zernio API client**: list numbers, assign an agent (set `forwardTo`), list calls with cost. |
| `apps/agent` | The **`wss://` runtime**. Speaks Telnyx media-streaming (Zernio's bridge), runs the flow, with swappable STT/LLM/TTS providers. Boots with stub providers so you can wire telephony before adding keys. |
| `apps/studio` | The **visual builder** (React + [React Flow](https://reactflow.dev)) + call monitor. |

## Quickstart

```bash
pnpm install

# 1. Run the studio (visual builder)
pnpm dev:studio        # http://localhost:5173

# 2. Run the agent runtime (needs Node 22+ for --experimental-strip-types)
cp apps/agent/.env.example apps/agent/.env   # or set AGENT_PORT
pnpm dev:agent         # ws://localhost:8787

# 3. Expose the runtime (e.g. `ngrok http 8787`) and point a Zernio number at it:
#    forwardTo = wss://<public-host>/?agentId=sample
#    (use @voxflow/zernio's assignAgent, or the Zernio dashboard)
```

Out of the box the runtime uses **stub providers** (no real speech) so the whole Telnyx ↔ flow path runs with zero API keys. Drop in Deepgram / OpenAI / ElevenLabs by implementing the `SttProvider` / `LlmProvider` / `TtsProvider` interfaces in `apps/agent/src/providers`.

## The flow model

A flow is `start → conversation* → end`. Each **node** carries a prompt; each **edge** carries a natural-language **condition**. After every caller turn the LLM decides which condition the conversation now satisfies and moves along that edge. Prompts, greetings and farewells support `{{variable}}` templating filled at call time. See `packages/flow/src/schema.ts` and `apps/agent/flows/sample.json`.

## Status

Early scaffold. Working: the flow schema + executor, the Zernio client, the runtime's Telnyx protocol + session loop (with stub voice), and the studio canvas. Next: real STT/LLM/TTS providers, in-canvas node editing + publish, agent versioning, and the call-monitor view.

## License

MIT
