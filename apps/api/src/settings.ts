import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, "..", "data", "settings.json");

export type ProviderId = "deepgram" | "openai" | "elevenlabs";
export type ProviderKeys = Partial<Record<ProviderId, string>>;

const IDS: ProviderId[] = ["deepgram", "openai", "elevenlabs"];

let cache: ProviderKeys | null = null;

async function load(): Promise<ProviderKeys> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(FILE, "utf8")) as ProviderKeys;
  } catch {
    cache = {};
  }
  return cache;
}

/** Raw keys — for the RUNTIME only (served on a localhost-bound endpoint). */
export async function getProviderKeys(): Promise<ProviderKeys> {
  return { ...(await load()) };
}

/** Masked status — safe for the studio UI (never leaks the secret itself). */
export async function providerStatus(): Promise<Record<ProviderId, boolean>> {
  const keys = await load();
  return Object.fromEntries(IDS.map((id) => [id, Boolean(keys[id])])) as Record<ProviderId, boolean>;
}

/** Set/clear keys. An empty string clears that provider. */
export async function setProviderKeys(patch: ProviderKeys): Promise<void> {
  const keys = await load();
  for (const id of IDS) {
    if (!(id in patch)) continue;
    const v = patch[id]?.trim();
    if (v) keys[id] = v;
    else delete keys[id];
  }
  cache = keys;
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(keys, null, 2));
}
