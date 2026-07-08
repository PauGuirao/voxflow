import type { LlmProvider } from "./types.ts";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * OpenAI chat completions for both legs of the reasoning: generating the agent's
 * spoken reply, and routing (which transition the conversation now satisfies).
 * Routing runs at temperature 0 and asks for just an index to keep it crisp.
 */
export function openaiLlm(apiKey: string, model: string): LlmProvider {
  const chat = async (messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string> => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts?.temperature ?? 0.6,
        max_tokens: opts?.maxTokens ?? 160,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as ChatResponse;
    return json.choices?.[0]?.message?.content ?? "";
  };

  return {
    async reply({ system, history }) {
      const messages: ChatMessage[] = [
        { role: "system", content: system },
        ...history.map((t) => ({ role: t.role, content: t.text }) satisfies ChatMessage),
      ];
      if (!history.some((t) => t.role === "user")) {
        messages.push({ role: "user", content: "The call just connected. Say your opening line now." });
      }
      return (await chat(messages)).trim();
    },

    async resolveTransition({ history, candidates }) {
      const conditional = candidates.filter((c) => c.condition);
      if (conditional.length === 0) return candidates.find((c) => !c.condition)?.edgeId ?? null;

      const list = candidates.map((c, i) => `${i}: ${c.condition || "(default)"} -> ${c.targetName}`).join("\n");
      const transcript = history
        .slice(-8)
        .map((t) => `${t.role}: ${t.text}`)
        .join("\n");
      const out = await chat(
        [
          {
            role: "system",
            content:
              "You route a live voice conversation. Reply with ONLY the number of the transition whose condition the transcript now satisfies, or -1 to stay on the current step. No other text.",
          },
          { role: "user", content: `Transcript:\n${transcript}\n\nTransitions:\n${list}\n\nNumber:` },
        ],
        { temperature: 0, maxTokens: 5 },
      );
      const idx = Number.parseInt(out.match(/-?\d+/)?.[0] ?? "-1", 10);
      return candidates[idx]?.edgeId ?? null;
    },
  };
}
