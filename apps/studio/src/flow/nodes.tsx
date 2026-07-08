import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { VoxNodeData } from "./model";

const palette = {
  start: { border: "#16a34a", label: "#15803d" },
  conversation: { border: "#2563eb", label: "#1d4ed8" },
  end: { border: "#dc2626", label: "#b91c1c" },
} as const;

function VoxNode({ data, selected }: NodeProps) {
  const d = data as VoxNodeData;
  const c = palette[d.kind];
  return (
    <div
      style={{
        width: 240,
        borderRadius: 12,
        border: `2px solid ${selected ? c.label : c.border}`,
        background: "#fff",
        padding: 12,
        boxShadow: selected ? `0 0 0 3px ${c.border}33` : "0 1px 3px rgba(0,0,0,0.08)",
        fontFamily: "system-ui, sans-serif",
        cursor: "grab",
      }}
    >
      {d.kind !== "start" && <Handle type="target" position={Position.Left} />}
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: c.label, fontWeight: 700 }}>
        {d.kind}
      </div>
      <div style={{ fontWeight: 600, margin: "2px 0 6px", color: "#0f172a" }}>{d.name || "(untitled)"}</div>
      <div
        style={{
          fontSize: 12,
          color: "#475569",
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {d.text || <em>—</em>}
      </div>
      {d.kind !== "end" && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

export const nodeTypes = {
  start: VoxNode,
  conversation: VoxNode,
  end: VoxNode,
};
