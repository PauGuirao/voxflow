import { AudioLines, Bot, PhoneCall, Phone, Plus, Trash2, Workflow, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { AgentSummary } from "@/agents/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type NavKey = "builder" | "numbers" | "calls";

const nav: { key: NavKey; label: string; icon: LucideIcon }[] = [
  { key: "builder", label: "Builder", icon: Workflow },
  { key: "numbers", label: "Numbers", icon: Phone },
  { key: "calls", label: "Calls", icon: PhoneCall },
];

export function AppSidebar(props: {
  active: NavKey;
  onNavigate: (k: NavKey) => void;
  agents: AgentSummary[];
  activeAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onCreateAgent: (name: string) => void;
  onDeleteAgent: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const submitCreate = () => {
    if (name.trim()) props.onCreateAgent(name.trim());
    setName("");
    setCreating(false);
  };

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-64 shrink-0 flex-col border-r">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
          <AudioLines className="size-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Voxflow</span>
          <span className="text-sidebar-foreground/50 text-[11px]">voice agents on Zernio</span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 p-2">
        {nav.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => props.onNavigate(key)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              props.active === key
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-sidebar-border mt-1 flex min-h-0 flex-1 flex-col border-t pt-2">
        <div className="flex items-center justify-between px-4 pb-1">
          <span className="text-sidebar-foreground/50 text-[11px] font-medium tracking-wide uppercase">Agents</span>
          <button
            onClick={() => setCreating((v) => !v)}
            className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground rounded p-1"
            title="New agent"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {creating && (
          <div className="px-2 pb-1">
            <Input
              autoFocus
              placeholder="Agent name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              onBlur={submitCreate}
              className="h-8"
            />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {props.agents.map((a) => (
            <div
              key={a.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                a.id === props.activeAgentId
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => props.onSelectAgent(a.id)}>
                <Bot className="size-4 shrink-0" />
                <span className="truncate">{a.name}</span>
              </button>
              <button
                onClick={() => props.onDeleteAgent(a.id)}
                className="text-sidebar-foreground/40 hover:text-destructive shrink-0 opacity-0 transition group-hover:opacity-100"
                title="Delete agent"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {props.agents.length === 0 && (
            <p className="text-sidebar-foreground/40 px-3 py-2 text-xs">No agents yet. Click + to create one.</p>
          )}
        </div>
      </div>

      <div className="border-sidebar-border border-t p-3">
        <a
          href="https://github.com/PauGuirao/voxflow"
          target="_blank"
          rel="noreferrer"
          className="text-sidebar-foreground/50 hover:text-sidebar-foreground text-xs transition-colors"
        >
          Open source · GitHub ↗
        </a>
      </div>
    </aside>
  );
}
