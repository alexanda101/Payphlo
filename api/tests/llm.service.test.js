const test = require("node:test");
const assert = require("node:assert/strict");

const { chat, loadLlmConfig } = require("../dist/services/llm.service");

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  global.fetch = originalFetch;
});

function mistralConfig(overrides = {}) {
  return {
    provider: "mistral",
    model: "mistral-small-latest",
    apiKey: "test-key",
    maxTokens: 400,
    maxInputChars: 8000,
    maxResponseChars: 2500,
    timeoutMs: 12000,
    temperature: 0.3,
    ...overrides,
  };
}

test("loadLlmConfig defaults to the Mistral model when provider is mistral", () => {
  process.env.LLM_PROVIDER = "mistral";
  process.env.LLM_API_KEY = "key";
  process.env.LLM_MAX_TOKENS = "99999";
  process.env.LLM_TIMEOUT_MS = "0";
  process.env.LLM_TEMPERATURE = "7";

  const config = loadLlmConfig();

  assert.equal(config.provider, "mistral");
  assert.equal(config.model, "mistral-small-latest");
  assert.equal(config.apiKey, "key");
  assert.equal(config.maxTokens, 1200);
  assert.equal(config.timeoutMs, 1000);
  assert.equal(config.temperature, 1);
});

test("loadLlmConfig treats unknown providers as disabled", () => {
  process.env.LLM_PROVIDER = "surprise-provider";

  const config = loadLlmConfig();

  assert.equal(config.provider, "none");
  assert.equal(config.model, "");
});

test("chat sends Mistral requests with model, limits, and auth header", async () => {
  let capturedUrl = "";
  let capturedInit = null;

  global.fetch = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "  abcdefghijklmnopqrstuvwxyz  ",
            },
          },
        ],
      }),
      text: async () => "",
    };
  };

  const response = await chat(
    [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Explain ETFs in plain English" },
    ],
    mistralConfig({
      maxTokens: 321,
      maxResponseChars: 12,
      temperature: 0.2,
    })
  );

  assert.equal(capturedUrl, "https://api.mistral.ai/v1/chat/completions");
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers.Authorization, "Bearer test-key");

  const body = JSON.parse(capturedInit.body);
  assert.equal(body.model, "mistral-small-latest");
  assert.equal(body.max_tokens, 321);
  assert.equal(body.temperature, 0.2);
  assert.deepEqual(body.messages, [
    { role: "system", content: "System prompt" },
    { role: "user", content: "Explain ETFs in plain English" },
  ]);
  assert.match(response, /^abcdefghijkl/);
  assert.match(response, /Response trimmed for length/);
});

test("chat trims older messages to stay inside the input budget", async () => {
  let body = null;

  global.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
      text: async () => "",
    };
  };

  await chat(
    [
      { role: "system", content: "12345" },
      { role: "assistant", content: "old context that should drop" },
      { role: "user", content: "latest question" },
    ],
    mistralConfig({ maxInputChars: 20 })
  );

  assert.deepEqual(body.messages, [
    { role: "system", content: "12345" },
    { role: "user", content: "latest question" },
  ]);
});

test("chat aborts slow provider calls so callers can fall back", async () => {
  global.fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });

  await assert.rejects(
    chat(
      [{ role: "user", content: "hello" }],
      mistralConfig({ timeoutMs: 1 })
    ),
    /mistral timed out after 1ms/
  );
});

test("chat rejects when no provider is configured", async () => {
  await assert.rejects(
    chat([{ role: "user", content: "hello" }], {
      ...mistralConfig(),
      provider: "none",
      apiKey: "",
      model: "",
    }),
    /LLM_NOT_CONFIGURED/
  );
});
