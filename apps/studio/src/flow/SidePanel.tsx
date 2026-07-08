import { Plus, Trash2, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { LLM_MODELS, STT_MODELS, TTS_MODELS, TTS_VOICES } from "./model-catalog";
import type { FlowMeta, Selection, VoxEdge, VoxNode } from "./model";

const textLabel = (kind: VoxNode["data"]["kind"]) =>
  kind === "start" ? "Greeting" : kind === "end" ? "Farewell" : "Prompt";

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold capitalize">{title}</h2>
      <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  );
}

function ModelSelect({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ModelLeg({ label, provider, children }: { label: string; provider: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-muted-foreground text-[11px]">{provider}</span>
      </div>
      {children}
    </div>
  );
}

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
  const { selection, meta } = props;
  const shell = "bg-card flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l p-4";
  const setModels = (patch: Partial<FlowMeta["models"]>) => props.onPatchMeta({ models: { ...meta.models, ...patch } });

  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const setVar = (k: string, v: string) => props.onPatchMeta({ variables: { ...meta.variables, [k]: v } });
  const removeVar = (k: string) => {
    const rest = { ...meta.variables };
    delete rest[k];
    props.onPatchMeta({ variables: rest });
  };
  const addVar = () => {
    if (!newKey.trim()) return;
    setVar(newKey.trim(), newVal);
    setNewKey("");
    setNewVal("");
  };

  if (selection.kind === "node" && props.node) {
    const node = props.node;
    const d = node.data;
    return (
      <aside className={shell}>
        <Header title={`${d.kind} node`} onClose={props.onClose} />
        <div className="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input value={d.name} onChange={(e) => props.onPatchNode(node.id, { name: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{textLabel(d.kind)}</Label>
          <Textarea
            className="min-h-32"
            placeholder={d.kind === "conversation" ? "What the agent should do in this step…" : "What the agent says…"}
            value={d.text}
            onChange={(e) => props.onPatchNode(node.id, { text: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Use <code className="bg-muted rounded px-1">{"{{variable}}"}</code> for runtime values.
          </p>
        </div>
        {d.kind !== "start" && (
          <>
            <Separator />
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => props.onDeleteNode(node.id)}>
              <Trash2 className="size-4" /> Delete node
            </Button>
          </>
        )}
      </aside>
    );
  }

  if (selection.kind === "edge" && props.edge) {
    const edge = props.edge;
    return (
      <aside className={shell}>
        <Header title="Transition" onClose={props.onClose} />
        <div className="flex flex-col gap-1.5">
          <Label>Condition</Label>
          <Textarea
            className="min-h-32"
            placeholder="e.g. the caller confirmed their appointment"
            value={edge.data?.condition ?? ""}
            onChange={(e) => props.onPatchEdge(edge.id, e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            The agent moves along this edge when the conversation satisfies the condition. Leave empty for an
            unconditional default.
          </p>
        </div>
      </aside>
    );
  }

  if (selection.kind === "global") {
    return (
      <aside className={shell}>
        <Header title="Global settings" onClose={props.onClose} />
        <div className="flex flex-col gap-1.5">
          <Label>Global prompt</Label>
          <Textarea className="min-h-40" value={meta.globalPrompt} onChange={(e) => props.onPatchMeta({ globalPrompt: e.target.value })} />
          <p className="text-muted-foreground text-xs">Prepended to every node prompt.</p>
        </div>

        <Separator />
        <div className="flex flex-col gap-2">
          <Label>Variables</Label>
          <p className="text-muted-foreground text-xs">
            Referenced as <code className="bg-muted rounded px-1">{"{{key}}"}</code> in prompts; filled at call time.
          </p>
          {Object.entries(meta.variables).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <code className="bg-muted shrink-0 rounded px-1.5 py-1 text-xs">{k}</code>
              <Input className="h-8" value={v} onChange={(e) => setVar(k, e.target.value)} />
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => removeVar(k)}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input className="h-8 w-24" placeholder="key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            <Input className="h-8" placeholder="value" value={newVal} onChange={(e) => setNewVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVar()} />
            <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={addVar}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>

        <Separator />
        <div className="flex flex-col gap-3">
          <Label>Models</Label>
          <ModelLeg label="Speech-to-text" provider={meta.models.stt.provider}>
            <ModelSelect value={meta.models.stt.model} options={STT_MODELS} onChange={(model) => setModels({ stt: { ...meta.models.stt, model } })} />
          </ModelLeg>
          <ModelLeg label="Language model" provider={meta.models.llm.provider}>
            <ModelSelect value={meta.models.llm.model} options={LLM_MODELS} onChange={(model) => setModels({ llm: { ...meta.models.llm, model } })} />
          </ModelLeg>
          <ModelLeg label="Text-to-speech" provider={meta.models.tts.provider}>
            <div className="grid grid-cols-2 gap-2">
              <ModelSelect value={meta.models.tts.model} options={TTS_MODELS} onChange={(model) => setModels({ tts: { ...meta.models.tts, model } })} />
              <ModelSelect value={meta.models.tts.voice} options={TTS_VOICES} onChange={(voice) => setModels({ tts: { ...meta.models.tts, voice } })} />
            </div>
          </ModelLeg>
          <p className="text-muted-foreground text-xs">Keys for these providers live in Settings.</p>
        </div>
      </aside>
    );
  }

  return null;
}
