import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlow, type Flow } from "@voxflow/flow";

const here = dirname(fileURLToPath(import.meta.url));
const flowsDir = join(here, "..", "flows");

/**
 * Load the flow for an agent. The skeleton reads `flows/<agentId>.json` (with a
 * `sample.json` fallback); wire this to the studio's API/DB to serve published
 * agent versions instead.
 */
export async function loadFlow(agentId: string): Promise<Flow> {
  for (const name of [`${agentId}.json`, "sample.json"]) {
    try {
      const raw = await readFile(join(flowsDir, name), "utf8");
      return parseFlow(JSON.parse(raw));
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`No flow found for agent "${agentId}" and no sample.json fallback`);
}
