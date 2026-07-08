import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlow, type Flow } from "@voxflow/flow";

const here = dirname(fileURLToPath(import.meta.url));
const flowsDir = join(here, "..", "flows");
const API_BASE = process.env.VOXFLOW_API_BASE ?? "http://localhost:8788";

/**
 * Load the flow for an agent. Prefers the agent store (what the studio edits, via
 * @voxflow/api); falls back to bundled `flows/<agentId>.json` when the API is
 * unreachable so a call still connects offline.
 */
export async function loadFlow(agentId: string): Promise<Flow> {
  try {
    const res = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentId)}`, { cache: "no-store" });
    if (res.ok) {
      // Serve the PUBLISHED version; fall back to the draft only before first publish.
      const { agent } = (await res.json()) as { agent?: { flow?: unknown; publishedFlow?: unknown } };
      const live = agent?.publishedFlow ?? agent?.flow;
      if (live) return parseFlow(live);
    }
  } catch {
    // API down — fall back to bundled flows below
  }
  for (const name of [`${agentId}.json`, "sample.json"]) {
    try {
      return parseFlow(JSON.parse(await readFile(join(flowsDir, name), "utf8")));
    } catch {
      // try next
    }
  }
  throw new Error(`No flow found for agent "${agentId}"`);
}
