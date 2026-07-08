import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZernioClient, type Channel } from "@voxflow/zernio";
import { getProviderKeys, type ProviderKeys, providerStatus, setProviderKeys } from "./settings.ts";
import { createAgent, deleteAgent, getAgent, listAgents, publishAgent, saveAgent } from "./store.ts";

const PORT = Number(process.env.API_PORT ?? 8788);
const AGENT_WSS = process.env.AGENT_PUBLIC_WSS_URL ?? "ws://localhost:8787";
const ZERNIO_BASE = process.env.ZERNIO_API_BASE ?? "https://zernio.com/api";

interface AssignBody {
  phoneNumberId?: string;
  accountId?: string;
  agentId?: string;
  channel?: Channel;
  recordingEnabled?: boolean;
}

function cors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-zernio-key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
}

function send(res: ServerResponse, status: number, body: unknown): void {
  cors(res);
  res.setHeader("content-type", "application/json");
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return (raw ? JSON.parse(raw) : {}) as T;
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  try {
    // --- Agent store (local data, no Zernio key required) ---
    if (path === "/api/agents") {
      if (method === "GET") return send(res, 200, { agents: await listAgents() });
      if (method === "POST") {
        const body = await readJson<{ name?: string }>(req);
        if (!body.name?.trim()) return send(res, 400, { error: "name is required" });
        return send(res, 200, { agent: await createAgent(body.name.trim()) });
      }
    }
    const publishMatch = path.match(/^\/api\/agents\/([^/]+)\/publish$/);
    if (publishMatch && method === "POST") {
      const a = await publishAgent(decodeURIComponent(publishMatch[1]!));
      return a ? send(res, 200, { agent: a }) : send(res, 404, { error: "Agent not found" });
    }
    const agentMatch = path.match(/^\/api\/agents\/([^/]+)$/);
    if (agentMatch) {
      const id = decodeURIComponent(agentMatch[1]!);
      if (method === "GET") {
        const a = await getAgent(id);
        return a ? send(res, 200, { agent: a }) : send(res, 404, { error: "Agent not found" });
      }
      if (method === "PUT") {
        const body = await readJson<{ name?: string; flow?: unknown }>(req);
        if (!body.flow) return send(res, 400, { error: "flow is required" });
        try {
          const a = await saveAgent(id, { name: body.name, flow: body.flow });
          return a ? send(res, 200, { agent: a }) : send(res, 404, { error: "Agent not found" });
        } catch (e) {
          return send(res, 400, { error: e instanceof Error ? e.message : "Invalid flow" });
        }
      }
      if (method === "DELETE") {
        return (await deleteAgent(id)) ? send(res, 200, { ok: true }) : send(res, 404, { error: "Agent not found" });
      }
    }

    // --- Provider keys (speech providers configured in the studio Settings) ---
    if (path === "/api/settings") {
      if (method === "GET") return send(res, 200, { providers: await providerStatus() });
      if (method === "PUT") {
        await setProviderKeys(await readJson<ProviderKeys>(req));
        return send(res, 200, { providers: await providerStatus() });
      }
    }
    // Raw keys for the RUNTIME. The server binds to localhost, so this stays on
    // the host; the studio never calls it (it uses the masked /api/settings).
    if (method === "GET" && path === "/api/provider-keys") {
      return send(res, 200, { keys: await getProviderKeys() });
    }

    // --- Zernio proxy (requires the user's key) ---
    const key = req.headers["x-zernio-key"];
    if (typeof key !== "string" || !key) return send(res, 401, { error: "Missing x-zernio-key header" });
    const zernio = new ZernioClient({ apiKey: key, baseUrl: ZERNIO_BASE });

    if (method === "GET" && path === "/api/phone-numbers") {
      return send(res, 200, { phoneNumbers: await zernio.listPhoneNumbers() });
    }
    if (method === "GET" && path === "/api/calls") {
      return send(res, 200, { calls: await zernio.listCalls({ limit: 50 }) });
    }
    if (method === "POST" && path === "/api/assign") {
      const body = await readJson<AssignBody>(req);
      if (!body.phoneNumberId || !body.accountId || !body.agentId || !body.channel) {
        return send(res, 400, { error: "phoneNumberId, accountId, agentId and channel are required" });
      }
      await zernio.assignAgent({
        phoneNumberId: body.phoneNumberId,
        accountId: body.accountId,
        agentId: body.agentId,
        agentWssBase: AGENT_WSS,
        channel: body.channel,
        recordingEnabled: body.recordingEnabled,
      });
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: "Not found" });
  } catch (err) {
    return send(res, 502, { error: err instanceof Error ? err.message : "Request failed" });
  }
});

// Bind to localhost only: the store holds provider secrets, so it shouldn't be
// reachable off-host. Studio + runtime both run locally and reach 127.0.0.1.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[api] Voxflow proxy on http://localhost:${PORT} (agent wss=${AGENT_WSS}, zernio=${ZERNIO_BASE})`);
});
