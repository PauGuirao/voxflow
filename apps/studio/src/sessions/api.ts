const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8788";

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

export async function listCallLogs(): Promise<CallLog[]> {
  const res = await fetch(`${API_BASE}/api/call-logs`, { cache: "no-store" });
  const json = (await res.json()) as { logs?: CallLog[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? `API ${res.status}`);
  return json.logs ?? [];
}
