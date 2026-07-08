import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNode } from "@voxflow/flow";

const palette = {
  start: { border: "#16a34a", label: "#15803d" },
  conversation: { border: "#2563eb", label: "#1d4ed8" },
  end: { border: "#dc2626", label: "#b91c1c" },
} as const;

function body(node: FlowNode): string {
  if (node.kind === "start") return node.greeting;
  if (node.kind === "end") return node.farewell;
  return node.prompt;
}

/** One card renderer keyed by node kind (registered under each kind below). */
function VoxNode({ data }: NodeProps) {
  const node = (data as { node: FlowNode }).node;
  const c = palette[node.kind];
  return (
    <div
      style={{
        width: 240,
        borderRadius: 12,
        border: `2px solid ${c.border}`,
        background: "#fff",
        padding: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {node.kind !== "start" && <Handle type="target" position={Position.Left} />}
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: c.label, fontWeight: 700 }}>
        {node.kind}
      </div>
      <div style={{ fontWeight: 600, margin: "2px 0 6px", color: "#0f172a" }}>{node.name || node.id}</div>
      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.4 }}>{body(node) || <em>—</em>}</div>
      {node.kind !== "end" && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

export const nodeTypes = {
  start: VoxNode,
  conversation: VoxNode,
  end: VoxNode,
};
