// Guardrails for the AI assistant.
// Blocks prompts asking for direct trading instructions or guaranteed returns.
// Always returns a friendly redirect, never silently censors.

const BLOCKED_PHRASES = [
  "guaranteed profit",
  "guaranteed return",
  "guaranteed returns",
  "tell me exactly what to buy",
  "exactly what to buy now",
  "buy this now",
  "sell this now",
  "should i buy",
  "should i sell",
  "double my money",
  "get rich quick",
  "insider tip",
  "pump and dump",
];

const HIGH_RISK_TOPICS = [
  "leverage",
  "margin",
  "options",
  "futures",
  "shorting",
];

export type GuardrailResult =
  | { blocked: true; reason: string; safeMessage: string }
  | { blocked: false; warnings: string[] };

export function checkGuardrails(prompt: string): GuardrailResult {
  const lower = prompt.toLowerCase();

  for (const phrase of BLOCKED_PHRASES) {
    if (lower.includes(phrase)) {
      return {
        blocked: true,
        reason: `Matched blocked phrase: "${phrase}"`,
        safeMessage:
          "I can offer education and risk-based insights, but I cannot give direct investment instructions or promise returns. Try asking something like: \"What factors matter when learning about tech stocks?\"",
      };
    }
  }

  const warnings: string[] = [];
  for (const topic of HIGH_RISK_TOPICS) {
    if (lower.includes(topic)) {
      warnings.push(
        `Heads up: ${topic} involves higher risk and potential losses beyond your initial investment.`
      );
    }
  }

  return { blocked: false, warnings };
}

export const DISCLAIMER =
  "This is general financial education, not personalized advice. Always consider your own situation and consult a licensed advisor for major decisions.";
