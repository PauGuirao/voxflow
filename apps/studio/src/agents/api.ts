import { parseFlow, type Flow } from "@voxflow/flow";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8788";

export interface AgentSummary {
  id: string;
  name: string;
  updatedAt: string;
  publishedAt?: string;
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API ${res.status}`);
  return json;
}

export async function listAgents(): Promise<AgentSummary[]> {
  return (await j<{ agents: AgentSummary[] }>("/api/agents")).agents;
}

export async function createAgent(name: string): Promise<AgentSummary> {
  return (await j<{ agent: AgentSummary }>("/api/agents", { method: "POST", body: JSON.stringify({ name }) })).agent;
}

export async function getAgentFlow(id: string): Promise<Flow> {
  const { agent } = await j<{ agent: { flow: unknown } }>(`/api/agents/${id}`);
  return parseFlow(agent.flow);
}

export async function saveAgentFlow(id: string, flow: Flow, name?: string): Promise<void> {
  await j(`/api/agents/${id}`, { method: "PUT", body: JSON.stringify({ flow, name }) });
}

export async function publishAgent(id: string): Promise<void> {
  await j(`/api/agents/${id}/publish`, { method: "POST" });
}

export async function deleteAgent(id: string): Promise<void> {
  await j(`/api/agents/${id}`, { method: "DELETE" });
}
