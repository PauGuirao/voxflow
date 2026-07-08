import type { LlmProvider } from "./types.ts";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * OpenAI chat completions. `reply` STREAMS tokens (onDelta) so the session can
 * start speaking the first sentence while the rest is still generating; routing
 * (`resolveTransition`) is a quick, non-streamed classification at temperature 0.
 */
export function openaiLlm(apiKey: string, model: string): LlmProvider {
  const post = (body: unknown, signal?: AbortSignal) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

  return {
    async reply({ system, history, onDelta, signal }) {
      const messages: ChatMessage[] = [
        { role: "system", content: system },
        ...history.map((t) => ({ role: t.role, content: t.text }) satisfies ChatMessage),
      ];
      if (!history.some((t) => t.role === "user")) {
        messages.push({ role: "user", content: "The call just connected. Say your opening line now." });
      }

      const res = await post({ model, messages, temperature: 0.6, max_tokens: 200, stream: true }, signal);
      if (!res.ok || !res.body) throw new Error(`OpenAI ${res.status}: ${await res.text().catch(() => "")}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta
              ?.content;
            if (delta) {
              full += delta;
              onDelta?.(delta);
            }
          } catch {
            // partial JSON across chunks — ignore
          }
        }
      }
      return full.trim();
    },

    async resolveTransition({ history, candidates }) {
      const conditional = candidates.filter((c) => c.condition);
      if (conditional.length === 0) return candidates.find((c) => !c.condition)?.edgeId ?? null;

      const list = candidates.map((c, i) => `${i}: ${c.condition || "(default)"} -> ${c.targetName}`).join("\n");
      const transcript = history
        .slice(-8)
        .map((t) => `${t.role}: ${t.text}`)
        .join("\n");
      const res = await post({
        model,
        temperature: 0,
        max_tokens: 5,
        messages: [
          {
            role: "system",
            content:
              "You route a live voice conversation. Reply with ONLY the number of the transition whose condition the transcript now satisfies, or -1 to stay on the current step. No other text.",
          },
          { role: "user", content: `Transcript:\n${transcript}\n\nTransitions:\n${list}\n\nNumber:` },
        ],
      });
      if (!res.ok) return null;
      const out = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const idx = Number.parseInt(out.choices?.[0]?.message?.content?.match(/-?\d+/)?.[0] ?? "-1", 10);
      return candidates[idx]?.edgeId ?? null;
    },
  };
}
