import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { VoxNodeData } from "./model";

const accent = {
  start: "text-emerald-600 border-l-emerald-500",
  conversation: "text-blue-600 border-l-blue-500",
  end: "text-rose-600 border-l-rose-500",
} as const;

function VoxNode({ data, selected }: NodeProps) {
  const d = data as VoxNodeData;
  return (
    <div
      className={cn(
        "bg-card w-60 rounded-lg border border-l-4 p-3 shadow-sm transition-shadow",
        accent[d.kind],
        selected ? "ring-ring/50 ring-2" : "hover:shadow-md",
      )}
    >
      {d.kind !== "start" && <Handle type="target" position={Position.Left} className="!size-2.5 !border-2" />}
      <div className={cn("text-[10px] font-bold tracking-wide uppercase", accent[d.kind].split(" ")[0])}>{d.kind}</div>
      <div className="text-foreground mt-0.5 mb-1 truncate font-semibold">{d.name || "(untitled)"}</div>
      <div className="text-muted-foreground line-clamp-3 text-xs leading-snug">{d.text || <em>—</em>}</div>
      {d.kind !== "end" && <Handle type="source" position={Position.Right} className="!size-2.5 !border-2" />}
    </div>
  );
}

export const nodeTypes = {
  start: VoxNode,
  conversation: VoxNode,
  end: VoxNode,
};
