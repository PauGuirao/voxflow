import { z } from "zod";

/**
 * A Voxflow agent is a directed graph the conversation walks at runtime.
 *
 *   start ──▶ conversation ──▶ conversation ──▶ end
 *                    └───(condition)───▶ conversation
 *
 * - `start`   the entry point; carries the greeting spoken on connect.
 * - `conversation` a step with a prompt the agent follows while it's active.
 * - `end`     terminal; carries an optional farewell, then the call hangs up.
 *
 * Edges carry a natural-language `condition`. After each user turn the runtime
 * asks the LLM which outgoing condition (if any) the conversation now satisfies,
 * and moves along that edge. An empty condition is an unconditional fallthrough.
 *
 * The graph is the single source of truth: the studio edits it, the agent
 * runtime executes it, and a published version is immutable (see AgentVersion).
 */

export const startNodeSchema = z.object({
  id: z.string(),
  kind: z.literal("start"),
  name: z.string().default("Start"),
  /** First thing the agent says when the call connects. Supports {{variables}}. */
  greeting: z.string().default(""),
});

export const conversationNodeSchema = z.object({
  id: z.string(),
  kind: z.literal("conversation"),
  name: z.string().default(""),
  /** Instruction the agent follows while this node is active. Supports {{variables}}. */
  prompt: z.string().default(""),
});

export const endNodeSchema = z.object({
  id: z.string(),
  kind: z.literal("end"),
  name: z.string().default("End"),
  /** Optional closing line spoken before hangup. Supports {{variables}}. */
  farewell: z.string().default(""),
});

export const nodeSchema = z.discriminatedUnion("kind", [
  startNodeSchema,
  conversationNodeSchema,
  endNodeSchema,
]);

export const edgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  /**
   * Natural-language condition that moves the conversation along this edge when
   * the transcript so far satisfies it (e.g. "the caller confirmed their name").
   * Empty = unconditional fallthrough (taken as soon as the node is reached).
   */
  condition: z.string().default(""),
});

export const modelConfigSchema = z.object({
  stt: z.object({ provider: z.string(), model: z.string() }),
  llm: z.object({ provider: z.string(), model: z.string() }),
  tts: z.object({ provider: z.string(), model: z.string(), voice: z.string() }),
});

export const flowSchema = z.object({
  version: z.literal(1).default(1),
  /** Prepended to every node prompt: persona, tone, guardrails, global rules. */
  globalPrompt: z.string().default(""),
  /** Runtime-filled values referenced as {{key}} in prompts, greetings, farewells. */
  variables: z.record(z.string(), z.string()).default({}),
  models: modelConfigSchema,
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

export type StartNode = z.infer<typeof startNodeSchema>;
export type ConversationNode = z.infer<typeof conversationNodeSchema>;
export type EndNode = z.infer<typeof endNodeSchema>;
export type FlowNode = z.infer<typeof nodeSchema>;
export type FlowEdge = z.infer<typeof edgeSchema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type Flow = z.infer<typeof flowSchema>;

/** Parse + validate untrusted flow JSON (studio payloads, DB reads). */
export function parseFlow(input: unknown): Flow {
  return flowSchema.parse(input);
}
