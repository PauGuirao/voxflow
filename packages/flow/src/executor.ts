import type { Flow, FlowEdge, FlowNode } from "./schema.ts";

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

/** A transition the runtime may take out of the current node. */
export interface TransitionCandidate {
  edgeId: string;
  /** Human/LLM-readable condition; "" means an unconditional default edge. */
  condition: string;
  targetName: string;
}

/**
 * Injected by the runtime: given the conversation so far and the current node's
 * outgoing edges, decide which edge (if any) the conversation now satisfies.
 * Returns the chosen `edgeId`, or `null` to stay on the current node.
 *
 * Kept as an injected function so this package has ZERO runtime dependencies —
 * the agent runtime wires it to an LLM; tests wire it to a stub.
 */
export type TransitionResolver = (input: {
  history: Turn[];
  candidates: TransitionCandidate[];
}) => Promise<string | null>;

/** Substitute {{key}} tokens from `variables`; unknown keys are left intact. */
export function renderTemplate(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key]! : whole,
  );
}

export interface AdvanceResult {
  /** True if we moved to a new node this turn. */
  moved: boolean;
  /** True once the current node is an `end` node — the runtime should hang up. */
  ended: boolean;
  node: FlowNode;
}

/**
 * Walks a Flow graph for one live call. Pure state + graph logic: it decides
 * WHAT prompt is active and WHERE to go next, but delegates every LLM call (reply
 * generation, condition evaluation) and every audio op to the runtime.
 */
export class FlowSession {
  private readonly flow: Flow;
  private readonly variables: Record<string, string>;
  private readonly nodesById: Map<string, FlowNode>;
  private currentId: string;
  private ended = false;

  constructor(flow: Flow, opts?: { variables?: Record<string, string> }) {
    this.flow = flow;
    this.variables = { ...flow.variables, ...(opts?.variables ?? {}) };
    this.nodesById = new Map(flow.nodes.map((n) => [n.id, n]));

    const start = flow.nodes.find((n) => n.kind === "start");
    if (!start) throw new Error("Flow has no start node");
    this.currentId = start.id;
  }

  get current(): FlowNode {
    const node = this.nodesById.get(this.currentId);
    if (!node) throw new Error(`Unknown node id: ${this.currentId}`);
    return node;
  }

  get isEnded(): boolean {
    return this.ended;
  }

  /**
   * Enter the graph: step off the start node onto its first real node and return
   * the greeting to speak. If the start edge lands directly on an end node, the
   * session is immediately ended and the greeting doubles as the farewell.
   */
  begin(): { greeting: string; node: FlowNode } {
    const start = this.current;
    const greeting = start.kind === "start" ? this.render(start.greeting) : "";
    const next = this.edgesFrom(start.id)[0];
    if (next) this.moveTo(next.to);
    return { greeting, node: this.current };
  }

  /** Global prompt + the active node's prompt, variables resolved. */
  systemPrompt(): string {
    const node = this.current;
    const nodePrompt = node.kind === "conversation" ? node.prompt : "";
    return [this.flow.globalPrompt, nodePrompt]
      .map((p) => this.render(p).trim())
      .filter(Boolean)
      .join("\n\n");
  }

  /** Farewell for the current (end) node, or "" if not on an end node. */
  farewell(): string {
    const node = this.current;
    return node.kind === "end" ? this.render(node.farewell) : "";
  }

  /**
   * After a user turn, evaluate the current node's outgoing edges and move if a
   * condition is satisfied. The runtime calls this once per user utterance.
   */
  async advance(input: { history: Turn[]; resolveTransition: TransitionResolver }): Promise<AdvanceResult> {
    if (this.ended) return { moved: false, ended: true, node: this.current };

    const edges = this.edgesFrom(this.currentId);
    if (edges.length === 0) return { moved: false, ended: false, node: this.current };

    const candidates: TransitionCandidate[] = edges.map((e) => ({
      edgeId: e.id,
      condition: e.condition,
      targetName: this.nodesById.get(e.to)?.name ?? e.to,
    }));

    const chosenId = await input.resolveTransition({ history: input.history, candidates });
    const chosen = chosenId ? edges.find((e) => e.id === chosenId) : undefined;
    if (!chosen) return { moved: false, ended: false, node: this.current };

    this.moveTo(chosen.to);
    return { moved: true, ended: this.ended, node: this.current };
  }

  private moveTo(nodeId: string): void {
    this.currentId = nodeId;
    if (this.current.kind === "end") this.ended = true;
  }

  private edgesFrom(nodeId: string): FlowEdge[] {
    return this.flow.edges.filter((e) => e.from === nodeId);
  }

  private render(text: string): string {
    return renderTemplate(text, this.variables);
  }
}
