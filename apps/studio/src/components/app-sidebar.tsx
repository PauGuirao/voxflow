import { AudioLines, PhoneCall, Phone, Workflow, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavKey = "builder" | "numbers" | "calls";

const items: { key: NavKey; label: string; icon: LucideIcon }[] = [
  { key: "builder", label: "Builder", icon: Workflow },
  { key: "numbers", label: "Numbers", icon: Phone },
  { key: "calls", label: "Calls", icon: PhoneCall },
];

export function AppSidebar({ active, onNavigate }: { active: NavKey; onNavigate: (k: NavKey) => void }) {
  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-60 shrink-0 flex-col border-r">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
          <AudioLines className="size-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Voxflow</span>
          <span className="text-sidebar-foreground/50 text-[11px]">voice agents on Zernio</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        <div className="text-sidebar-foreground/50 px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
          Agent
        </div>
        {items.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active === key
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

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
