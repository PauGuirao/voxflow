import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlow, type Flow } from "@voxflow/flow";

const here = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(here, "..", "data", "agents.json");

export interface AgentRecord {
  id: string;
  name: string;
  flow: Flow;
  updatedAt: string;
}
export type AgentSummary = Pick<AgentRecord, "id" | "name" | "updatedAt">;

/** Starter graph for a freshly created agent. */
function defaultFlow(name: string): Flow {
  return parseFlow({
    version: 1,
    globalPrompt: `You are ${name}, a helpful, concise voice assistant. Speak in short, natural sentences.`,
    variables: {},
    models: {
      stt: { provider: "deepgram", model: "nova-3" },
      llm: { provider: "openai", model: "gpt-4o-mini" },
      tts: { provider: "elevenlabs", model: "eleven_turbo_v2_5", voice: "Rachel" },
    },
    nodes: [
      { id: "start", kind: "start", name: "Start", greeting: "Hi! How can I help?" },
      { id: "main", kind: "conversation", name: "Conversation", prompt: "Help the caller with their request. Ask one question at a time." },
      { id: "end", kind: "end", name: "End", farewell: "Thanks for calling. Goodbye!" },
    ],
    edges: [
      { id: "e1", from: "start", to: "main", condition: "" },
      { id: "e2", from: "main", to: "end", condition: "the caller is done and says goodbye" },
    ],
  });
}

/** The seed agent — its id "sample" matches the runtime + studio default. */
function seedAgent(): AgentRecord {
  const flow = defaultFlow("Ana");
  flow.globalPrompt = "You are Ana, a warm, concise voice receptionist for {{business}}. Speak in short, natural sentences. Never invent information.";
  flow.variables = { business: "Acme Clinic" };
  return { id: "sample", name: "Sample receptionist", flow, updatedAt: "2026-01-01T00:00:00.000Z" };
}

let cache: AgentRecord[] | null = null;

async function load(): Promise<AgentRecord[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(DATA_FILE, "utf8")) as AgentRecord[];
  } catch {
    cache = [seedAgent()];
    await persist();
  }
  return cache;
}

async function persist(): Promise<void> {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(cache ?? [], null, 2));
}

export async function listAgents(): Promise<AgentSummary[]> {
  return (await load()).map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
}

export async function getAgent(id: string): Promise<AgentRecord | undefined> {
  return (await load()).find((a) => a.id === id);
}

export async function createAgent(name: string): Promise<AgentRecord> {
  const list = await load();
  const record: AgentRecord = { id: randomUUID(), name, flow: defaultFlow(name), updatedAt: new Date().toISOString() };
  list.push(record);
  await persist();
  return record;
}

export async function saveAgent(id: string, patch: { name?: string; flow: unknown }): Promise<AgentRecord | undefined> {
  const list = await load();
  const record = list.find((a) => a.id === id);
  if (!record) return undefined;
  record.flow = parseFlow(patch.flow);
  if (patch.name) record.name = patch.name;
  record.updatedAt = new Date().toISOString();
  await persist();
  return record;
}

export async function deleteAgent(id: string): Promise<boolean> {
  const list = await load();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  await persist();
  return true;
}
