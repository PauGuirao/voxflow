import type { Edge, Node } from "@xyflow/react";
import { parseFlow, type Flow, type FlowNode } from "@voxflow/flow";

/** Node kinds carry different text fields (greeting/prompt/farewell); the editor
 *  normalizes them to a single `text` so one panel edits all three. */
export type Kind = "start" | "conversation" | "end";
export type VoxNodeData = { kind: Kind; name: string; text: string };
export type VoxNode = Node<VoxNodeData>;
export type VoxEdgeData = { condition: string };
export type VoxEdge = Edge<VoxEdgeData>;

export type FlowMeta = {
  globalPrompt: string;
  variables: Record<string, string>;
  models: Flow["models"];
};

export type Selection =
  | { kind: "closed" }
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | { kind: "global" };

const textOf = (n: FlowNode): string =>
  n.kind === "start" ? n.greeting : n.kind === "end" ? n.farewell : n.prompt;

/** Flow (no coordinates) → a laid-out, editable React Flow graph. */
export function flowToGraph(flow: Flow): { nodes: VoxNode[]; edges: VoxEdge[]; meta: FlowMeta } {
  const depth = new Map<string, number>();
  const start = flow.nodes.find((n) => n.kind === "start");
  const queue: string[] = [];
  if (start) {
    depth.set(start.id, 0);
    queue.push(start.id);
  }
  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    for (const e of flow.edges.filter((e) => e.from === id)) {
      if (!depth.has(e.to)) {
        depth.set(e.to, d + 1);
        queue.push(e.to);
      }
    }
  }
  const rowAt = new Map<number, number>();
  const nodes: VoxNode[] = flow.nodes.map((n) => {
    const d = depth.get(n.id) ?? 0;
    const row = rowAt.get(d) ?? 0;
    rowAt.set(d, row + 1);
    return {
      id: n.id,
      type: n.kind,
      position: { x: d * 320, y: row * 170 },
      data: { kind: n.kind, name: n.name, text: textOf(n) },
    };
  });
  const edges: VoxEdge[] = flow.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.condition || undefined,
    animated: Boolean(e.condition),
    data: { condition: e.condition },
  }));
  return { nodes, edges, meta: { globalPrompt: flow.globalPrompt, variables: flow.variables, models: flow.models } };
}

/** Editable graph → a validated Flow (for export / handing to the runtime). */
export function graphToFlow(nodes: VoxNode[], edges: VoxEdge[], meta: FlowMeta): Flow {
  return parseFlow({
    version: 1,
    globalPrompt: meta.globalPrompt,
    variables: meta.variables,
    models: meta.models,
    nodes: nodes.map((n) => {
      const d = n.data;
      if (d.kind === "start") return { id: n.id, kind: "start", name: d.name, greeting: d.text };
      if (d.kind === "end") return { id: n.id, kind: "end", name: d.name, farewell: d.text };
      return { id: n.id, kind: "conversation", name: d.name, prompt: d.text };
    }),
    edges: edges.map((e) => ({ id: e.id, from: e.source, to: e.target, condition: e.data?.condition ?? "" })),
  });
}
