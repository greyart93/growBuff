export type AiResult<T> = {
  data: T;
  model: string;
  tokens: number;
  degraded: boolean;
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Calls Claude when ANTHROPIC_API_KEY is set, otherwise returns the
 * deterministic, grounded fallback produced by the calling agent.
 */
export async function generateJson<T>(options: {
  system: string;
  prompt: string;
  fallback: T;
  maxTokens?: number;
}): Promise<AiResult<T>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { data: options.fallback, model: "mock-grounded-v1", tokens: 0, degraded: true };
  }

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: options.maxTokens ?? 1200,
        system: `${options.system}\n\nRespond with a single valid JSON object and nothing else.`,
        messages: [{ role: "user", content: options.prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Anthropic ${response.status}`);
    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };
    const text = (payload.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n");
    const parsed = extractJson(text);
    if (!parsed) throw new Error("Model returned no JSON");
    return {
      data: parsed as T,
      model: payload.model ?? "claude",
      tokens: (payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0),
      degraded: false,
    };
  } catch (error) {
    console.error("AI provider failed, using grounded fallback", error);
    return { data: options.fallback, model: "mock-grounded-v1", tokens: 0, degraded: true };
  }
}
