import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZernioClient, type Channel } from "@voxflow/zernio";

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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function send(res: ServerResponse, status: number, body: unknown): void {
  cors(res);
  res.setHeader("content-type", "application/json");
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<AssignBody> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as AssignBody) : {};
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const key = req.headers["x-zernio-key"];
  if (typeof key !== "string" || !key) {
    return send(res, 401, { error: "Missing x-zernio-key header" });
  }
  const zernio = new ZernioClient({ apiKey: key, baseUrl: ZERNIO_BASE });

  try {
    if (req.method === "GET" && url.pathname === "/api/phone-numbers") {
      return send(res, 200, { phoneNumbers: await zernio.listPhoneNumbers() });
    }
    if (req.method === "GET" && url.pathname === "/api/calls") {
      return send(res, 200, { calls: await zernio.listCalls({ limit: 50 }) });
    }
    if (req.method === "POST" && url.pathname === "/api/assign") {
      const body = await readJson(req);
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
    return send(res, 502, { error: err instanceof Error ? err.message : "Zernio request failed" });
  }
});

server.listen(PORT, () => {
  console.log(`[api] Voxflow proxy on http://localhost:${PORT} (agent wss=${AGENT_WSS}, zernio=${ZERNIO_BASE})`);
});
