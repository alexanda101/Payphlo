const test = require("node:test");
const assert = require("node:assert/strict");

const { generateResponse } = require("../dist/services/ai.service");
const guardrails = require("../dist/services/guardrails.service");
const llm = require("../dist/services/llm.service");

const originalEnv = { ...process.env };
const originalChat = llm.chat;

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  llm.chat = originalChat;
});

test("generateResponse removes provider-written disclaimers before appending Payphlo disclaimer", async () => {
  process.env.LLM_PROVIDER = "mistral";
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_MODEL = "mistral-small-latest";

  llm.chat = async () =>
    [
      "Diversification means spreading money across different investments.",
      "",
      "— This is general financial education, not personalized advice.",
    ].join("\n");

  const response = await generateResponse("What is diversification?");
  const occurrences = response.content.match(/general financial education/g) || [];

  assert.equal(response.source, "llm");
  assert.equal(response.provider, "mistral");
  assert.equal(occurrences.length, 1);
  assert.match(response.content, /Always consider your own situation/);
  assert.match(response.content, new RegExp(guardrails.DISCLAIMER));
});
