import { Background, Controls, MiniMap, ReactFlow, type OnConnect, type OnEdgesChange, type OnNodesChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { VoxEdge, VoxNode } from "./model";
import { nodeTypes } from "./nodes";

/** Controlled React Flow surface. The handlers make it interactive — the missing
 *  onNodesChange was why nodes wouldn't move. */
export function Canvas(props: {
  nodes: VoxNode[];
  edges: VoxEdge[];
  onNodesChange: OnNodesChange<VoxNode>;
  onEdgesChange: OnEdgesChange<VoxEdge>;
  onConnect: OnConnect;
  onNodeClick: (id: string) => void;
  onEdgeClick: (id: string) => void;
  onPaneClick: () => void;
}) {
  return (
    <ReactFlow
      nodes={props.nodes}
      edges={props.edges}
      nodeTypes={nodeTypes}
      onNodesChange={props.onNodesChange}
      onEdgesChange={props.onEdgesChange}
      onConnect={props.onConnect}
      onNodeClick={(_, node) => props.onNodeClick(node.id)}
      onEdgeClick={(_, edge) => props.onEdgeClick(edge.id)}
      onPaneClick={props.onPaneClick}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
