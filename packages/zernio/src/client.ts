/**
 * Minimal typed client for the Zernio telephony API.
 *
 * Voxflow doesn't run any telephony itself — it leans on Zernio for numbers,
 * call bridging, recording, and billing. The one write it needs is "point this
 * number at my agent": Zernio's calling config takes a `forwardTo`, and when
 * that's a `wss://` URL Zernio streams the live call's audio to it (the same
 * media-streaming bridge documented in Zernio's PUBLISHING-SYSTEM). So
 * "assigning an agent" == setting `forwardTo` to this runtime's public wss URL
 * with the agent id in the query string.
 *
 * Channels:
 *  - `whatsapp` → WhatsApp Business Calling  (POST .../calling)
 *  - `pstn`     → regular phone calls on the DID (POST .../enable-voice)
 * Both accept the same `forwardTo`, so an agent answers on either channel with
 * no change to the runtime — the WhatsApp lane is the differentiator vs
 * phone-only platforms.
 */

export interface ZernioClientOptions {
  apiKey: string;
  /** Defaults to https://zernio.com/api */
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface PhoneNumber {
  id: string;
  phoneNumber: string;
  accountId: string;
  callingEnabled: boolean;
  forwardTo: string | null;
}

export interface CallRecord {
  id: string;
  from: string;
  to: string;
  channel: "whatsapp" | "pstn";
  direction: "inbound" | "outbound";
  status: string;
  durationSeconds: number | null;
  billableCostUSD: number | null;
  createdAt: string;
}

export type Channel = "whatsapp" | "pstn";

export class ZernioClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ZernioClientOptions) {
    if (!opts.apiKey) throw new Error("ZernioClient: apiKey is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://zernio.com/api").replace(/\/$/, "");
    this.fetchImpl = opts.fetch ?? fetch;
  }

  /** List the account's phone numbers (canonical `/v1/phone-numbers`). */
  async listPhoneNumbers(): Promise<PhoneNumber[]> {
    const data = await this.request<{ phoneNumbers?: PhoneNumber[] }>("GET", "/v1/phone-numbers");
    return data.phoneNumbers ?? [];
  }

  /** Recent calls with per-call cost (drives the studio's call monitor). */
  async listCalls(params?: { limit?: number }): Promise<CallRecord[]> {
    const qs = params?.limit ? `?limit=${params.limit}` : "";
    const data = await this.request<{ calls?: CallRecord[] }>("GET", `/v1/voice/calls${qs}`);
    return data.calls ?? [];
  }

  /**
   * Point a Zernio number at a Voxflow agent by setting its `forwardTo` to this
   * runtime's public wss URL. `agentWssBase` is AGENT_PUBLIC_WSS_URL; we append
   * the agent id so the runtime loads the right flow when Zernio connects.
   */
  async assignAgent(input: {
    phoneNumberId: string;
    accountId: string;
    agentId: string;
    agentWssBase: string;
    channel: Channel;
    recordingEnabled?: boolean;
  }): Promise<void> {
    const forwardTo = buildAgentForwardTo(input.agentWssBase, input.agentId);
    const path =
      input.channel === "whatsapp"
        ? `/v1/whatsapp/phone-numbers/${input.phoneNumberId}/calling`
        : `/v1/whatsapp/phone-numbers/${input.phoneNumberId}/enable-voice`;
    await this.request("POST", path, {
      accountId: input.accountId,
      forwardTo,
      recordingEnabled: input.recordingEnabled ?? false,
    });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : {};
    if (!res.ok) {
      const message =
        (json as { error?: { message?: string } | string })?.error ?? `Zernio API ${res.status}`;
      throw new Error(typeof message === "string" ? message : (message.message ?? `Zernio API ${res.status}`));
    }
    return json as T;
  }
}

/** `wss://host/path` + `?agentId=...`, preserving any existing query string. */
export function buildAgentForwardTo(agentWssBase: string, agentId: string): string {
  const sep = agentWssBase.includes("?") ? "&" : "?";
  return `${agentWssBase}${sep}agentId=${encodeURIComponent(agentId)}`;
}
