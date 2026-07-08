/**
 * Browser voice test. Connects to the agent runtime the exact way Zernio's
 * bridge does (Telnyx media-streaming frames) so it exercises the real
 * STT→LLM→TTS pipeline. Runs the AudioContext at 8kHz so mic capture and
 * playback are already at telephony rate — the only conversion is G.711 µ-law.
 */

export type VoiceStatus = "connecting" | "listening" | "ended" | "error" | "mic-denied";

export interface VoiceTest {
  stop(): void;
}

function linearToMulaw(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = (sample >> 8) & 0x80;
  if (sign) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function mulawToLinear(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return sign ? -sample : sample;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}
function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface MediaFrame {
  event?: string;
  media?: { payload?: string };
}

export function startVoiceTest(opts: {
  wsUrl: string;
  onStatus: (s: VoiceStatus) => void;
  onLevel?: (rms: number) => void;
}): VoiceTest {
  const ctx = new AudioContext({ sampleRate: 8000 });
  const ws = new WebSocket(opts.wsUrl);
  let playHead = ctx.currentTime;
  let scheduled: AudioBufferSourceNode[] = [];
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let stream: MediaStream | null = null;
  let stopped = false;

  opts.onStatus("connecting");

  ws.onopen = () => {
    ws.send(JSON.stringify({ event: "start", stream_id: "browser-test" }));
    void startMic();
  };
  ws.onerror = () => opts.onStatus("error");
  ws.onclose = () => {
    if (!stopped) opts.onStatus("ended");
    cleanup();
  };
  ws.onmessage = (ev) => {
    if (typeof ev.data !== "string") return;
    let msg: MediaFrame;
    try {
      msg = JSON.parse(ev.data) as MediaFrame;
    } catch {
      return;
    }
    if (msg.event === "media" && msg.media?.payload) playFrame(msg.media.payload);
    if (msg.event === "clear") clearPlayback(); // barge-in: agent audio cut off
  };

  async function startMic(): Promise<void> {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      source = ctx.createMediaStreamSource(stream);
      processor = ctx.createScriptProcessor(512, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const bytes = new Uint8Array(input.length);
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i] ?? 0));
          sumSq += s * s;
          bytes[i] = linearToMulaw((s * 32767) | 0);
        }
        opts.onLevel?.(Math.sqrt(sumSq / input.length));
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ event: "media", media: { track: "inbound", payload: toBase64(bytes) } }));
        }
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      opts.onStatus("listening");
    } catch {
      opts.onStatus("mic-denied");
    }
  }

  function playFrame(payloadB64: string): void {
    const mulaw = fromBase64(payloadB64);
    const pcm = new Float32Array(mulaw.length);
    for (let i = 0; i < mulaw.length; i++) pcm[i] = mulawToLinear(mulaw[i]!) / 32768;
    const buffer = ctx.createBuffer(1, pcm.length, 8000);
    buffer.copyToChannel(pcm, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    playHead = Math.max(playHead, ctx.currentTime);
    src.start(playHead);
    playHead += buffer.duration;
    scheduled.push(src);
    src.onended = () => {
      scheduled = scheduled.filter((s) => s !== src);
    };
  }

  function clearPlayback(): void {
    for (const s of scheduled) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    }
    scheduled = [];
    playHead = ctx.currentTime;
  }

  function cleanup(): void {
    processor?.disconnect();
    source?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  }

  return {
    stop() {
      stopped = true;
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ event: "stop" }));
          ws.close();
        }
      } catch {
        // ignore
      }
      cleanup();
      opts.onStatus("ended");
    },
  };
}
