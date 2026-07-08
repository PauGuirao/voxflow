import { Background, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import type { Flow } from "@voxflow/flow";
import { layoutFlow } from "./layout";
import { nodeTypes } from "./nodes";

export function Canvas({ flow }: { flow: Flow }) {
  const { nodes, edges } = useMemo(() => layoutFlow(flow), [flow]);
  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
      <Background />
      <Controls />
    </ReactFlow>
  );
}
