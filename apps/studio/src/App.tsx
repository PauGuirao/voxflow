import { addEdge, useEdgesState, useNodesState, type Connection } from "@xyflow/react";
import { type CSSProperties, useCallback, useMemo, useState } from "react";
import { Canvas } from "./flow/Canvas";
import { flowToGraph, graphToFlow, type FlowMeta, type Selection, type VoxEdge, type VoxNode } from "./flow/model";
import { SidePanel } from "./flow/SidePanel";
import { sampleFlow } from "./sampleFlow";
import { ZernioPanel } from "./zernio/ZernioPanel";

// The MVP edits one agent; its id matches apps/agent/flows/sample.json so an
// assigned number reaches the running runtime. Real agents get published ids.
const AGENT_ID = "sample";

let seq = 100;
const nid = (p: string) => `${p}_${seq++}`;

const headerBtn: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export function App() {
  const initial = useMemo(() => flowToGraph(sampleFlow), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<VoxNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<VoxEdge>(initial.edges);
  const [meta, setMeta] = useState<FlowMeta>(initial.meta);
  const [selection, setSelection] = useState<Selection>({ kind: "closed" });
  const [view, setView] = useState<"builder" | "numbers">("builder");

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, id: nid("e"), data: { condition: "" } }, eds)),
    [setEdges],
  );

  const addStep = () => {
    const id = nid("node");
    setNodes((ns) => [
      ...ns,
      { id, type: "conversation", position: { x: 180, y: 180 }, data: { kind: "conversation", name: "New step", text: "" } },
    ]);
    setSelection({ kind: "node", id });
  };

  const patchNode = (id: string, patch: Partial<VoxNode["data"]>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));

  const patchEdge = (id: string, condition: string) =>
    setEdges((es) =>
      es.map((e) => (e.id === id ? { ...e, data: { condition }, label: condition || undefined, animated: Boolean(condition) } : e)),
    );

  const deleteNode = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelection({ kind: "closed" });
  };

  const exportFlow = () => {
    const json = JSON.stringify(graphToFlow(nodes, edges, meta), null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = `${AGENT_ID}.json`;
    a.click();
  };

  const selNode = selection.kind === "node" ? nodes.find((n) => n.id === selection.id) : undefined;
  const selEdge = selection.kind === "edge" ? edges.find((e) => e.id === selection.id) : undefined;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 17, color: "#0f172a", marginRight: 8 }}>Voxflow</strong>
        <button style={{ ...headerBtn, background: view === "builder" ? "#eff6ff" : "#fff" }} onClick={() => setView("builder")}>
          Builder
        </button>
        <button style={{ ...headerBtn, background: view === "numbers" ? "#eff6ff" : "#fff" }} onClick={() => setView("numbers")}>
          Numbers
        </button>
        <div style={{ flex: 1 }} />
        {view === "builder" && (
          <>
            <button style={headerBtn} onClick={addStep}>
              + Step
            </button>
            <button style={headerBtn} onClick={() => setSelection({ kind: "global" })}>
              Global
            </button>
            <button style={headerBtn} onClick={exportFlow}>
              Export
            </button>
          </>
        )}
      </header>

      {view === "numbers" ? (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <ZernioPanel agentId={AGENT_ID} />
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Canvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(id) => setSelection({ kind: "node", id })}
              onEdgeClick={(id) => setSelection({ kind: "edge", id })}
              onPaneClick={() => setSelection({ kind: "closed" })}
            />
          </div>
          {selection.kind !== "closed" && (
            <SidePanel
              selection={selection}
              node={selNode}
              edge={selEdge}
              meta={meta}
              onPatchNode={patchNode}
              onPatchEdge={patchEdge}
              onPatchMeta={(patch) => setMeta((m) => ({ ...m, ...patch }))}
              onDeleteNode={deleteNode}
              onClose={() => setSelection({ kind: "closed" })}
            />
          )}
        </div>
      )}
    </div>
  );
}
