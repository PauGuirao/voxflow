import { Check, Ear, Loader2, MessageSquare, Volume2, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getProviderStatus, type ProviderId, type ProviderStatus, saveProviderKeys } from "./api";

const PROVIDERS: { id: ProviderId; name: string; role: string; icon: LucideIcon; placeholder: string; url: string }[] = [
  { id: "deepgram", name: "Deepgram", role: "Speech-to-text", icon: Ear, placeholder: "Deepgram API key", url: "https://console.deepgram.com" },
  { id: "openai", name: "OpenAI", role: "Language model", icon: MessageSquare, placeholder: "sk-…", url: "https://platform.openai.com/api-keys" },
  { id: "elevenlabs", name: "ElevenLabs", role: "Text-to-speech", icon: Volume2, placeholder: "ElevenLabs API key", url: "https://elevenlabs.io/app/settings/api-keys" },
];

export function SettingsPanel() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProviderStatus()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings"));
  }, []);

  const dirty = Object.values(drafts).some((v) => v?.trim());

  const save = async () => {
    setSaveState("saving");
    setError(null);
    try {
      const patch = Object.fromEntries(Object.entries(drafts).filter(([, v]) => v?.trim()));
      setStatus(await saveProviderKeys(patch));
      setDrafts({});
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaveState("idle");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-1">
        <h1 className="text-xl font-semibold">Providers</h1>
        <p className="text-muted-foreground text-sm">
          Connect the speech providers your agents use. Keys are stored on the local Voxflow server and read by the
          agent runtime at call time, they never touch the browser bundle.
        </p>
      </div>

      {error && <div className="bg-destructive/10 text-destructive my-4 rounded-md px-3 py-2 text-sm">{error}</div>}

      <div className="mt-4 flex flex-col gap-3">
        {PROVIDERS.map(({ id, name, role, icon: Icon, placeholder, url }) => (
          <Card key={id}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-muted flex size-9 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {name}
                    {status?.[id] ? <Badge variant="secondary">Connected</Badge> : <Badge variant="outline">Not set</Badge>}
                  </div>
                  <div className="text-muted-foreground text-xs">{role}</div>
                </div>
                <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-xs">
                  Get key →
                </a>
              </div>
              <Input
                type="password"
                placeholder={status?.[id] ? "•••••••• (replace)" : placeholder}
                value={drafts[id] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={!dirty || saveState === "saving"}>
          {saveState === "saving" ? <Loader2 className="size-4 animate-spin" /> : saveState === "saved" ? <Check className="size-4" /> : null}
          {saveState === "saved" ? "Saved" : "Save keys"}
        </Button>
      </div>
    </div>
  );
}
