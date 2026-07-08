import type { Edge, Node } from "@xyflow/react";
import type { Flow } from "@voxflow/flow";

/**
 * The runtime Flow graph has no coordinates (positions aren't part of the
 * contract), so the studio derives a left-to-right layered layout: BFS depth
 * from the start node sets the column, order within a depth sets the row.
 */
export function layoutFlow(flow: Flow): { nodes: Node[]; edges: Edge[] } {
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
  const nodes: Node[] = flow.nodes.map((n) => {
    const d = depth.get(n.id) ?? 0;
    const row = rowAt.get(d) ?? 0;
    rowAt.set(d, row + 1);
    return {
      id: n.id,
      type: n.kind,
      position: { x: d * 320, y: row * 170 },
      data: { node: n },
    };
  });

  const edges: Edge[] = flow.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.condition || undefined,
    animated: Boolean(e.condition),
  }));

  return { nodes, edges };
}
