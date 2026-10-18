const test = require("node:test");
const assert = require("node:assert/strict");

const { checkGuardrails, DISCLAIMER } = require("../dist/services/guardrails.service");

test("guardrails block direct recommendation prompts", () => {
  const result = checkGuardrails("Should I buy NVDA today?");

  assert.equal(result.blocked, true);
  assert.match(result.reason, /should i buy/);
  assert.match(result.safeMessage, /cannot give direct investment instructions/i);
});

test("guardrails block guaranteed return language", () => {
  const result = checkGuardrails("Can you give me a guaranteed profit idea?");

  assert.equal(result.blocked, true);
  assert.match(result.reason, /guaranteed profit/);
});

test("guardrails warn on high-risk topics without blocking education", () => {
  const result = checkGuardrails("Explain options and margin in simple terms");

  assert.equal(result.blocked, false);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings.join(" "), /options/);
  assert.match(result.warnings.join(" "), /margin/);
});

test("disclaimer clearly frames Phlo as education, not advice", () => {
  assert.match(DISCLAIMER, /general financial education/);
  assert.match(DISCLAIMER, /not personalized advice/);
});
