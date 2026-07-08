import { addEdge, useEdgesState, useNodesState, type Connection } from "@xyflow/react";
import { Check, Download, LayoutGrid, Loader2, LogOut, PhoneCall, Plus, Rocket, Save, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AgentSummary,
  createAgent as apiCreate,
  deleteAgent as apiDelete,
  getAgentFlow,
  listAgents,
  publishAgent,
  saveAgentFlow,
} from "@/agents/api";
import { AppSidebar, type NavKey } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Canvas } from "./flow/Canvas";
import { flowToGraph, graphToFlow, tidyLayout, type FlowMeta, type Selection, type VoxEdge, type VoxNode } from "./flow/model";
import { SidePanel } from "./flow/SidePanel";
import { sampleFlow } from "./sampleFlow";
import { SettingsPanel } from "./settings/SettingsPanel";
import { TestPanel } from "./test/TestPanel";
import { clearKey, getKey } from "./zernio/api";
import { CallsPanel } from "./zernio/CallsPanel";
import { ConnectCard } from "./zernio/ConnectCard";
import { NumbersPanel } from "./zernio/NumbersPanel";

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
  const [testing, setTesting] = useState(false);

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [publishing, setPublishing] = useState(false);
  const [apiDown, setApiDown] = useState(false);

  const loadInto = useCallback(
    async (id: string) => {
      const flow = await getAgentFlow(id);
      const g = flowToGraph(flow);
      setNodes(g.nodes);
      setEdges(g.edges);
      setMeta(g.meta);
      setSelection({ kind: "closed" });
      setActiveId(id);
    },
    [setNodes, setEdges],
  );

  // Bootstrap: pull the agent list; seed one if empty; load the first.
  useEffect(() => {
    (async () => {
      try {
        let list = await listAgents();
        if (list.length === 0) {
          const created = await apiCreate("My agent");
          list = [created];
        }
        setAgents(list);
        await loadInto(list[0]!.id);
      } catch {
        setApiDown(true); // proxy not running — stay on the local sample
      }
    })();
  }, [loadInto]);

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

  const activeAgent = agents.find((a) => a.id === activeId);
  const activeName = activeAgent?.name ?? "sample";
  // Unpublished = the draft (updatedAt) is newer than what's live (publishedAt).
  const unpublished = activeAgent ? !activeAgent.publishedAt || activeAgent.updatedAt > activeAgent.publishedAt : false;

  const publish = async () => {
    if (!activeId) return;
    setPublishing(true);
    try {
      await saveAgentFlow(activeId, graphToFlow(nodes, edges, meta), activeName);
      await publishAgent(activeId);
      setAgents(await listAgents());
    } catch {
      // leave state as-is
    } finally {
      setPublishing(false);
    }
  };

  const save = async () => {
    if (!activeId) return;
    setSaveState("saving");
    try {
      await saveAgentFlow(activeId, graphToFlow(nodes, edges, meta), activeName);
      setAgents(await listAgents());
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("idle");
    }
  };

  const createAgent = async (name: string) => {
    const created = await apiCreate(name);
    setAgents(await listAgents());
    setView("builder");
    await loadInto(created.id);
  };

  const deleteAgent = async (id: string) => {
    await apiDelete(id);
    const list = await listAgents();
    setAgents(list);
    if (id === activeId && list[0]) await loadInto(list[0].id);
  };

  const exportFlow = () => {
    const json = JSON.stringify(graphToFlow(nodes, edges, meta), null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = `${activeName.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
  };

  const selNode = selection.kind === "node" ? nodes.find((n) => n.id === selection.id) : undefined;
  const selEdge = selection.kind === "edge" ? edges.find((e) => e.id === selection.id) : undefined;
  const title = view === "builder" ? activeName : view === "numbers" ? "Numbers" : view === "calls" ? "Calls" : "Settings";
  const agentId = activeId ?? "sample";

  return (
    <div className="text-foreground flex h-screen">
      <AppSidebar
        active={view}
        onNavigate={setView}
        agents={agents}
        activeAgentId={activeId}
        onSelectAgent={(id) => {
          setView("builder");
          void loadInto(id);
        }}
        onCreateAgent={(name) => void createAgent(name)}
        onDeleteAgent={(id) => void deleteAgent(id)}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <h1 className="truncate font-semibold">{title}</h1>
          {apiDown && view === "builder" && <span className="text-destructive text-xs">proxy offline · editing local sample</span>}
          <div className="flex-1" />
          {view === "builder" ? (
            <>
              <Button variant="ghost" size="sm" onClick={addStep}>
                <Plus className="size-4" /> Step
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setNodes((ns) => tidyLayout(ns, edges))}>
                <LayoutGrid className="size-4" /> Tidy
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelection({ kind: "global" })}>
                <Settings2 className="size-4" /> Global
              </Button>
              <Button variant="ghost" size="sm" onClick={exportFlow}>
                <Download className="size-4" /> Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelection({ kind: "closed" });
                  setTesting(true);
                }}
              >
                <PhoneCall className="size-4" /> Test call
              </Button>
              <Button variant="outline" size="sm" onClick={save} disabled={saveState === "saving" || apiDown}>
                {saveState === "saving" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : saveState === "saved" ? (
                  <Check className="size-4" />
                ) : (
                  <Save className="size-4" />
                )}
                {saveState === "saved" ? "Saved" : "Save"}
              </Button>
              <Button
                size="sm"
                variant={unpublished ? "default" : "ghost"}
                onClick={publish}
                disabled={publishing || apiDown || !unpublished}
              >
                {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                {unpublished ? "Publish" : "Live"}
              </Button>
            </>
          ) : (
            (view === "numbers" || view === "calls") &&
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
                  key={activeId ?? "sample"}
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(id) => {
                    setTesting(false);
                    setSelection({ kind: "node", id });
                  }}
                  onEdgeClick={(id) => {
                    setTesting(false);
                    setSelection({ kind: "edge", id });
                  }}
                  onPaneClick={() => setSelection({ kind: "closed" })}
                />
              </div>
              {testing ? (
                <TestPanel agentId={agentId} onClose={() => setTesting(false)} />
              ) : (
                selection.kind !== "closed" && (
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
                )
              )}
            </div>
          )}
          {view === "numbers" &&
            (connected ? <NumbersPanel agentId={agentId} /> : <ConnectCard onConnect={() => setConnected(true)} />)}
          {view === "calls" && (connected ? <CallsPanel /> : <ConnectCard onConnect={() => setConnected(true)} />)}
          {view === "settings" && <SettingsPanel />}
        </div>
      </main>
    </div>
  );
}
