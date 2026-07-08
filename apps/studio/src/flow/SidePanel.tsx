import type { CSSProperties } from "react";
import type { FlowMeta, Selection, VoxEdge, VoxNode } from "./model";

const wrap: CSSProperties = {
  width: 340,
  borderLeft: "1px solid #e2e8f0",
  background: "#fff",
  padding: 16,
  overflowY: "auto",
  fontFamily: "system-ui, sans-serif",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const label: CSSProperties = { fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 };
const input: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const textarea: CSSProperties = { ...input, minHeight: 120, resize: "vertical", lineHeight: 1.4 };

const textLabel = (kind: VoxNode["data"]["kind"]) =>
  kind === "start" ? "Greeting" : kind === "end" ? "Farewell" : "Prompt";

export function SidePanel(props: {
  selection: Selection;
  node?: VoxNode;
  edge?: VoxEdge;
  meta: FlowMeta;
  onPatchNode: (id: string, patch: Partial<VoxNode["data"]>) => void;
  onPatchEdge: (id: string, condition: string) => void;
  onPatchMeta: (patch: Partial<FlowMeta>) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
}) {
  const { selection } = props;

  const header = (title: string) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <strong style={{ fontSize: 14, color: "#0f172a" }}>{title}</strong>
      <button onClick={props.onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", fontSize: 18 }}>
        ×
      </button>
    </div>
  );

  if (selection.kind === "node" && props.node) {
    const node = props.node;
    const d = node.data;
    return (
      <aside style={wrap}>
        {header(`${d.kind} node`)}
        <div>
          <div style={label}>Name</div>
          <input style={input} value={d.name} onChange={(e) => props.onPatchNode(node.id, { name: e.target.value })} />
        </div>
        <div>
          <div style={label}>{textLabel(d.kind)}</div>
          <textarea
            style={textarea}
            placeholder={d.kind === "conversation" ? "What the agent should do in this step…" : "What the agent says…"}
            value={d.text}
            onChange={(e) => props.onPatchNode(node.id, { text: e.target.value })}
          />
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Use {"{{variable}}"} for runtime values.</div>
        </div>
        {d.kind !== "start" && (
          <button
            onClick={() => props.onDeleteNode(node.id)}
            style={{ ...input, color: "#dc2626", cursor: "pointer", fontWeight: 600, borderColor: "#fecaca", background: "#fef2f2" }}
          >
            Delete node
          </button>
        )}
      </aside>
    );
  }

  if (selection.kind === "edge" && props.edge) {
    const edge = props.edge;
    return (
      <aside style={wrap}>
        {header("Transition")}
        <div>
          <div style={label}>Condition</div>
          <textarea
            style={textarea}
            placeholder="e.g. the caller confirmed their appointment"
            value={edge.data?.condition ?? ""}
            onChange={(e) => props.onPatchEdge(edge.id, e.target.value)}
          />
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            The agent moves along this edge when the conversation satisfies the condition. Leave empty for an
            unconditional default.
          </div>
        </div>
      </aside>
    );
  }

  if (selection.kind === "global") {
    const { meta } = props;
    return (
      <aside style={wrap}>
        {header("Global settings")}
        <div>
          <div style={label}>Global prompt</div>
          <textarea
            style={textarea}
            value={meta.globalPrompt}
            onChange={(e) => props.onPatchMeta({ globalPrompt: e.target.value })}
          />
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Prepended to every node prompt.</div>
        </div>
        <div>
          <div style={label}>Models</div>
          <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
            STT: {meta.models.stt.provider}/{meta.models.stt.model}
            <br />
            LLM: {meta.models.llm.provider}/{meta.models.llm.model}
            <br />
            TTS: {meta.models.tts.provider}/{meta.models.tts.model} ({meta.models.tts.voice})
          </div>
        </div>
      </aside>
    );
  }

  return null;
}
