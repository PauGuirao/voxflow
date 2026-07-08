import { Canvas } from "./flow/Canvas";
import { sampleFlow } from "./sampleFlow";

export function App() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
      <header
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <strong style={{ fontSize: 18, color: "#0f172a" }}>Voxflow</strong>
        <span style={{ color: "#64748b", fontSize: 13 }}>
          open-source visual voice-agent builder, running on the Zernio API (PSTN + WhatsApp)
        </span>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Canvas flow={sampleFlow} />
      </div>
    </div>
  );
}
