import { type CSSProperties, useEffect, useState } from "react";
import { assignAgent, clearKey, getKey, listNumbers, setKey, type PhoneNumber } from "./api";

const input: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const btn = (primary = false): CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 8,
  border: primary ? "none" : "1px solid #cbd5e1",
  background: primary ? "#2563eb" : "#fff",
  color: primary ? "#fff" : "#334155",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
});

/** Paste a Zernio API key, list your numbers, and point one at this agent. */
export function ZernioPanel({ agentId }: { agentId: string }) {
  const [hasKey, setHasKey] = useState(Boolean(getKey()));
  const [draftKey, setDraftKey] = useState("");
  const [numbers, setNumbers] = useState<PhoneNumber[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      setNumbers(await listNumbers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load numbers");
      setNumbers([]);
    }
  };

  useEffect(() => {
    if (hasKey) void refresh();
  }, [hasKey]);

  const connect = () => {
    if (!draftKey.trim()) return;
    setKey(draftKey);
    setHasKey(true);
  };
  const disconnect = () => {
    clearKey();
    setHasKey(false);
    setNumbers(null);
  };

  const assign = async (n: PhoneNumber, channel: "whatsapp" | "pstn") => {
    setBusy(`${n.id}:${channel}`);
    setError(null);
    try {
      await assignAgent({ phoneNumberId: n.id, accountId: n.accountId, agentId, channel });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(null);
    }
  };

  if (!hasKey) {
    return (
      <div style={{ maxWidth: 460, margin: "48px auto", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Connect Zernio</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          Paste a Zernio API key to list your phone numbers and point them at this agent. The key is stored in your
          browser and sent only to the local Voxflow proxy, never bundled or shared.
        </p>
        <input
          style={input}
          type="password"
          placeholder="zk_live_…"
          value={draftKey}
          onChange={(e) => setDraftKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && connect()}
        />
        <button style={btn(true)} onClick={connect}>
          Connect
        </button>
        <a href="https://zernio.com/dashboard/api-keys" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#2563eb" }}>
          Get a key →
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Your numbers</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn()} onClick={refresh}>
            Refresh
          </button>
          <button style={btn()} onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", padding: 10, borderRadius: 8 }}>{error}</div>}
      {numbers === null && <div style={{ color: "#64748b", fontSize: 14 }}>Loading…</div>}
      {numbers?.length === 0 && !error && <div style={{ color: "#64748b", fontSize: 14 }}>No numbers on this account yet.</div>}
      {numbers?.map((n) => {
        const pointedHere = n.forwardTo?.includes(`agentId=${agentId}`) ?? false;
        return (
          <div key={n.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, color: "#0f172a" }}>{n.phoneNumber}</div>
              <div style={{ fontSize: 12, color: pointedHere ? "#15803d" : "#94a3b8", marginTop: 2 }}>
                {pointedHere ? `▶ pointed at "${agentId}"` : n.forwardTo ? `forwards to ${n.forwardTo.slice(0, 40)}…` : "no agent assigned"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn(true)} disabled={busy !== null} onClick={() => assign(n, "whatsapp")}>
                {busy === `${n.id}:whatsapp` ? "…" : "Assign · WhatsApp"}
              </button>
              <button style={btn()} disabled={busy !== null} onClick={() => assign(n, "pstn")}>
                {busy === `${n.id}:pstn` ? "…" : "PSTN"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
