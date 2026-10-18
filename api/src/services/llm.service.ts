// LLM provider abstraction.
// One interface, multiple swappable backends. Pick a provider via env:
//   LLM_PROVIDER = openai | mistral | anthropic | none
//   LLM_MODEL    = e.g. gpt-4o-mini | mistral-small-latest | claude-3-5-haiku-latest
//   LLM_API_KEY  = <provider key>
// If LLM_PROVIDER is unset/none or no key is configured, callers should fall
// back to the rule-based templates (handled in ai.service.ts).

export type LlmProvider = "openai" | "mistral" | "anthropic" | "none";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmConfig = {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  /** Hard cap so a runaway prompt can't burn money. */
  maxTokens: number;
  /** Hard cap on text sent to the provider. */
  maxInputChars: number;
  /** Hard cap on text accepted back from the provider. */
  maxResponseChars: number;
  /** Abort slow provider requests so Phlo can fall back. */
  timeoutMs: number;
  temperature: number;
};

export function loadLlmConfig(): LlmConfig {
  const provider = normalizeProvider(process.env.LLM_PROVIDER);
  return {
    provider,
    model: process.env.LLM_MODEL || defaultModel(provider),
    apiKey: process.env.LLM_API_KEY || "",
    maxTokens: parseIntEnv("LLM_MAX_TOKENS", 600, 100, 1200),
    maxInputChars: parseIntEnv("LLM_MAX_INPUT_CHARS", 8000, 1000, 20000),
    maxResponseChars: parseIntEnv("LLM_MAX_RESPONSE_CHARS", 2500, 500, 6000),
    timeoutMs: parseIntEnv("LLM_TIMEOUT_MS", 12000, 1000, 30000),
    temperature: parseFloatEnv("LLM_TEMPERATURE", 0.3, 0, 1),
  };
}

export function isLlmConfigured(cfg: LlmConfig = loadLlmConfig()): boolean {
  return cfg.provider !== "none" && Boolean(cfg.apiKey);
}

function normalizeProvider(value?: string): LlmProvider {
  const provider = (value || "none").toLowerCase();
  if (
    provider === "openai" ||
    provider === "mistral" ||
    provider === "anthropic"
  ) {
    return provider;
  }
  return "none";
}

function defaultModel(provider: LlmProvider): string {
  switch (provider) {
    case "openai":
      return "gpt-4o-mini";
    case "mistral":
      return "mistral-small-latest";
    case "anthropic":
      return "claude-3-5-haiku-latest";
    default:
      return "";
  }
}

function parseIntEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function parseFloatEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseFloat(process.env[name] || "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Send a chat completion. Returns plain text content.
 * Throws on network/auth errors; the caller decides whether to fall back.
 */
export async function chat(
  messages: ChatMessage[],
  cfg: LlmConfig = loadLlmConfig()
): Promise<string> {
  if (!isLlmConfigured(cfg)) {
    throw new Error("LLM_NOT_CONFIGURED");
  }
  const preparedMessages = trimMessagesToBudget(messages, cfg.maxInputChars);
  let content = "";
  switch (cfg.provider) {
    case "openai":
      content = await chatOpenAI(preparedMessages, cfg);
      break;
    case "mistral":
      content = await chatMistral(preparedMessages, cfg);
      break;
    case "anthropic":
      content = await chatAnthropic(preparedMessages, cfg);
      break;
    default:
      throw new Error("LLM_NOT_CONFIGURED");
  }
  if (!content.trim()) {
    throw new Error("LLM_EMPTY_RESPONSE");
  }
  return content;
}

function trimMessagesToBudget(messages: ChatMessage[], maxInputChars: number) {
  const system = messages.find((m) => m.role === "system");
  const rest = messages.filter((m) => m !== system);
  const systemContent = system?.content.slice(0, maxInputChars) || "";
  let remaining = Math.max(maxInputChars - systemContent.length, 0);
  const kept: ChatMessage[] = [];

  for (let i = rest.length - 1; i >= 0; i -= 1) {
    if (remaining <= 0) break;

    const message = rest[i];
    const content =
      message.content.length > remaining
        ? message.content.slice(message.content.length - remaining)
        : message.content;
    remaining -= content.length;
    kept.push({ ...message, content });
  }

  kept.reverse();

  return system
    ? [{ ...system, content: systemContent }, ...kept]
    : kept;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  cfg: LlmConfig
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`${cfg.provider} timed out after ${cfg.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function trimResponse(content: string, cfg: LlmConfig) {
  const clean = content.trim();
  if (clean.length <= cfg.maxResponseChars) return clean;
  return `${clean.slice(0, cfg.maxResponseChars).trimEnd()}\n\n[Response trimmed for length.]`;
}

/* ---------- OpenAI ---------- */
async function chatOpenAI(messages: ChatMessage[], cfg: LlmConfig): Promise<string> {
  const r = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
      }),
    },
    cfg
  );
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`OpenAI error ${r.status}: ${text.slice(0, 300)}`);
  }
  const j = (await r.json()) as { choices: { message: { content: string } }[] };
  return trimResponse(j.choices[0]?.message?.content || "", cfg);
}

/* ---------- Mistral ---------- */
async function chatMistral(messages: ChatMessage[], cfg: LlmConfig): Promise<string> {
  const r = await fetchWithTimeout(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
      }),
    },
    cfg
  );
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Mistral error ${r.status}: ${text.slice(0, 300)}`);
  }
  const j = (await r.json()) as { choices: { message: { content: string } }[] };
  return trimResponse(j.choices[0]?.message?.content || "", cfg);
}

/* ---------- Anthropic ---------- */
async function chatAnthropic(messages: ChatMessage[], cfg: LlmConfig): Promise<string> {
  // Anthropic separates the system prompt from the messages array.
  const system = messages.find((m) => m.role === "system")?.content;
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const r = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        system,
        messages: rest,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
      }),
    },
    cfg
  );
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Anthropic error ${r.status}: ${text.slice(0, 300)}`);
  }
  const j = (await r.json()) as { content: { type: string; text: string }[] };
  const content = j.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  return trimResponse(content, cfg);
}
