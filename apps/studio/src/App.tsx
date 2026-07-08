import { addEdge, useEdgesState, useNodesState, type Connection } from "@xyflow/react";
import { Download, LogOut, Plus, Settings2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AppSidebar, type NavKey } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Canvas } from "./flow/Canvas";
import { flowToGraph, graphToFlow, type FlowMeta, type Selection, type VoxEdge, type VoxNode } from "./flow/model";
import { SidePanel } from "./flow/SidePanel";
import { sampleFlow } from "./sampleFlow";
import { clearKey, getKey } from "./zernio/api";
import { CallsPanel } from "./zernio/CallsPanel";
import { ConnectCard } from "./zernio/ConnectCard";
import { NumbersPanel } from "./zernio/NumbersPanel";

// The MVP edits one agent; its id matches apps/agent/flows/sample.json so an
// assigned number reaches the running runtime. Real agents get published ids.
const AGENT_ID = "sample";

let seq = 100;
const nid = (p: string) => `${p}_${seq++}`;

export function App() {
  const initial = useMemo(() => flowToGraph(sampleFlow), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<VoxNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<VoxEdge>(initial.edges);
  const [meta, setMeta] = useState<FlowMeta>(initial.meta);
  const [selection, setSelection] = useState<Selection>({ kind: "closed" });
  const [view, setView] = useState<NavKey>("builder");
  const [connected, setConnected] = useState(Boolean(getKey()));

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
  const title = view === "builder" ? "Builder" : view === "numbers" ? "Numbers" : "Calls";

  return (
    <div className="text-foreground flex h-screen">
      <AppSidebar active={view} onNavigate={setView} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <h1 className="font-semibold">{title}</h1>
          <span className="text-muted-foreground text-xs">
            {view === "builder" ? `agent · ${AGENT_ID}` : "via Zernio"}
          </span>
          <div className="flex-1" />
          {view === "builder" ? (
            <>
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="size-4" /> Step
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelection({ kind: "global" })}>
                <Settings2 className="size-4" /> Global
              </Button>
              <Button size="sm" onClick={exportFlow}>
                <Download className="size-4" /> Export
              </Button>
            </>
          ) : (
            connected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearKey();
                  setConnected(false);
                }}
              >
                <LogOut className="size-4" /> Disconnect
              </Button>
            )
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "builder" && (
            <div className="flex h-full">
              <div className="min-w-0 flex-1">
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
          {view === "numbers" &&
            (connected ? <NumbersPanel agentId={AGENT_ID} /> : <ConnectCard onConnect={() => setConnected(true)} />)}
          {view === "calls" && (connected ? <CallsPanel /> : <ConnectCard onConnect={() => setConnected(true)} />)}
        </div>
      </main>
    </div>
  );
}
