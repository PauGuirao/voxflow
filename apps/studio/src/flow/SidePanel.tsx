import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  const shell = "bg-card flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l p-4";

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
    const { meta } = props;
    return (
      <aside className={shell}>
        <Header title="Global settings" onClose={props.onClose} />
        <div className="flex flex-col gap-1.5">
          <Label>Global prompt</Label>
          <Textarea className="min-h-40" value={meta.globalPrompt} onChange={(e) => props.onPatchMeta({ globalPrompt: e.target.value })} />
          <p className="text-muted-foreground text-xs">Prepended to every node prompt.</p>
        </div>
        <Separator />
        <div className="flex flex-col gap-1.5">
          <Label>Models</Label>
          <div className="text-muted-foreground space-y-0.5 text-xs">
            <div>STT · {meta.models.stt.provider}/{meta.models.stt.model}</div>
            <div>LLM · {meta.models.llm.provider}/{meta.models.llm.model}</div>
            <div>TTS · {meta.models.tts.provider}/{meta.models.tts.model} ({meta.models.tts.voice})</div>
          </div>
        </div>
      </aside>
    );
  }

  return null;
}
