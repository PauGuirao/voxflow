/** Talks to the local @voxflow/api proxy, which forwards to Zernio with the key
 *  the user pasted (kept in localStorage, sent as x-zernio-key — never bundled). */

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8788";
const KEY_STORAGE = "voxflow.zernioKey";

export function getKey(): string {
  return localStorage.getItem(KEY_STORAGE) ?? "";
}
export function setKey(k: string): void {
  localStorage.setItem(KEY_STORAGE, k.trim());
}
export function clearKey(): void {
  localStorage.removeItem(KEY_STORAGE);
}

export interface PhoneNumber {
  id: string;
  phoneNumber: string;
  accountId: string;
  callingEnabled: boolean;
  forwardTo: string | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "x-zernio-key": getKey(), "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Proxy ${res.status}`);
  return json;
}

export async function listNumbers(): Promise<PhoneNumber[]> {
  const { phoneNumbers } = await req<{ phoneNumbers: PhoneNumber[] }>("/api/phone-numbers");
  return phoneNumbers;
}

export async function assignAgent(input: {
  phoneNumberId: string;
  accountId: string;
  agentId: string;
  channel: "whatsapp" | "pstn";
}): Promise<void> {
  await req("/api/assign", { method: "POST", body: JSON.stringify(input) });
}
