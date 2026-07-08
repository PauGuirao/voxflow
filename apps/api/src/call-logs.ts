import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, "..", "data", "call-logs.json");

export interface CostBreakdown {
  stt: number;
  llm: number;
  tts: number;
  total: number;
}
export interface TranscriptTurn {
  role: "user" | "assistant";
  text: string;
}
export interface CallLog {
  id: string;
  agentId: string;
  from: string;
  to: string;
  direction: string;
  durationSeconds: number;
  cost: CostBreakdown;
  transcript: TranscriptTurn[];
  createdAt: string;
}

let cache: CallLog[] | null = null;

async function load(): Promise<CallLog[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(FILE, "utf8")) as CallLog[];
  } catch {
    cache = [];
  }
  return cache;
}

async function persist(): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(cache ?? [], null, 2));
}

/** Newest first; the runtime posts one on every hangup. Capped so the file stays small. */
export async function addCallLog(input: Omit<CallLog, "id" | "createdAt">): Promise<CallLog> {
  const list = await load();
  const log: CallLog = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  list.unshift(log);
  if (list.length > 300) list.length = 300;
  await persist();
  return log;
}

export async function listCallLogs(): Promise<CallLog[]> {
  return (await load()).slice(0, 100);
}
