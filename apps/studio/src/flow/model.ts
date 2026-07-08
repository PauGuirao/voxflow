import Dagre from "@dagrejs/dagre";
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

const NODE_W = 240;
const NODE_H = 96;

/** Position nodes with dagre (left-to-right) so any graph reads cleanly. */
export function tidyLayout(nodes: VoxNode[], edges: VoxEdge[]): VoxNode[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 48, ranksep: 90, marginx: 24, marginy: 24 });
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  Dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

const textOf = (n: FlowNode): string =>
  n.kind === "start" ? n.greeting : n.kind === "end" ? n.farewell : n.prompt;

/** Flow (no coordinates) → a laid-out, editable React Flow graph. */
export function flowToGraph(flow: Flow): { nodes: VoxNode[]; edges: VoxEdge[]; meta: FlowMeta } {
  const nodes: VoxNode[] = flow.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { kind: n.kind, name: n.name, text: textOf(n) },
  }));
  const edges: VoxEdge[] = flow.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.condition || undefined,
    animated: Boolean(e.condition),
    data: { condition: e.condition },
  }));
  return {
    nodes: tidyLayout(nodes, edges),
    edges,
    meta: { globalPrompt: flow.globalPrompt, variables: flow.variables, models: flow.models },
  };
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
