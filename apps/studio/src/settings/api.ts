const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8788";

export type ProviderId = "deepgram" | "openai" | "elevenlabs";
export type ProviderStatus = Record<ProviderId, boolean>;

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API ${res.status}`);
  return json;
}

export async function getProviderStatus(): Promise<ProviderStatus> {
  return (await j<{ providers: ProviderStatus }>("/api/settings")).providers;
}

export async function saveProviderKeys(patch: Partial<Record<ProviderId, string>>): Promise<ProviderStatus> {
  return (await j<{ providers: ProviderStatus }>("/api/settings", { method: "PUT", body: JSON.stringify(patch) })).providers;
}
