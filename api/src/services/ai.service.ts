// AI service: thin dispatcher.
// - If an LLM provider is configured, calls it with a strict educational system prompt.
// - Otherwise, falls back to the original rule-based templates.
// - Re-runs guardrails on the OUTPUT (post-check) before returning.

import { DISCLAIMER, checkGuardrails } from "./guardrails.service";
import {
  chat,
  isLlmConfigured,
  loadLlmConfig,
  type ChatMessage,
  type LlmProvider,
} from "./llm.service";

type Intent =
  | "transfer_timing"
  | "investing_basics"
  | "risk_tolerance"
  | "diversification"
  | "crypto"
  | "budgeting"
  | "compare"
  | "fallback"
  | "llm";

/* ============================================================
   Educational system prompts.
   The core product rule: EXPLAIN, never RECOMMEND.
   ============================================================ */

const EDUCATOR_SYSTEM_PROMPT = `
You are Payphlo's financial education assistant.

YOUR ROLE
- You teach concepts, define terms, and lay out trade-offs in plain English.
- You help users think through decisions, but you NEVER make the decision for them.
- Audience: everyday people new to investing and international transfers. Assume zero finance background.

HARD RULES — NEVER DO THESE
- Never tell the user to buy, sell, hold, short, enter, or exit a specific asset.
- Never predict prices, returns, or market direction ("will go up", "is undervalued", "good time to buy").
- Never give a personal recommendation ("you should…", "I'd put my money in…", "go with X over Y").
- Never promise outcomes, profits, or "safe" returns.
- Never give tax, legal, or licensed financial advice.

WHEN ASKED FOR AN OPINION OR PICK
- Acknowledge the question, then redirect to education:
  "I can't recommend a specific pick, but here's how investors typically think about this kind of question…"
- Offer a framework, relevant trade-offs, and neutral factors/questions that help the user learn.

STYLE
- Short paragraphs and bullet points. Maximum ~250 words unless the user asks for depth.
- Concrete and specific. Use numbers and examples where helpful.
- Calm, factual, neutral tone. No hype. No emojis.
- If a topic is high-risk (leverage, margin, options, futures, shorting, crypto), state the risk clearly.
- Do not write your own financial-advice disclaimer. Payphlo appends one automatically.

REMEMBER
- "Educate, don't advise" is a feature, not a limitation. The user came here to learn.
`.trim();

const COMPARATOR_SYSTEM_PROMPT = `
You are Payphlo's financial education assistant in COMPARE mode.

The user has selected 2-3 assets to compare. Your job is to help them UNDERSTAND
the differences, not to pick a winner.

OUTPUT STRUCTURE
1. One-line summary of each asset (what it is, sector, asset class).
2. A short side-by-side on the dimensions that matter:
   - Asset class & sector
   - Volatility / risk profile (use the risk level provided)
   - Typical role in a portfolio
   - One key concept a beginner can learn from each
3. A "How they differ" paragraph (3–5 sentences).
4. Close with: "Both have a place — what matters is how each fits your goals and time horizon."

HARD RULES
- NEVER say one is "better", "stronger", or "the right pick".
- NEVER predict which will outperform.
- NEVER tell the user which to buy.
- Stick to characteristics and trade-offs.

STYLE: Plain English, ~250 words, bullet points OK.
Do not write your own financial-advice disclaimer. Payphlo appends one automatically.
`.trim();

/* ============================================================
   Rule-based fallback (used when no LLM key is configured).
   ============================================================ */

type FallbackIntent = Exclude<Intent, "compare" | "llm">;

function detectIntent(prompt: string): FallbackIntent {
  const p = prompt.toLowerCase();
  if (/(send|transfer|remit|wire|fx|exchange rate)/.test(p)) return "transfer_timing";
  if (/(diversif|spread|allocation)/.test(p)) return "diversification";
  if (/(risk|volatil|safe|aggressive|conservative)/.test(p)) return "risk_tolerance";
  if (/(crypto|bitcoin|ethereum|btc|eth)/.test(p)) return "crypto";
  if (/(budget|save|spending|expense)/.test(p)) return "budgeting";
  if (/(stock|invest|portfolio|market|etf|index)/.test(p)) return "investing_basics";
  return "fallback";
}

const TEMPLATES: Record<Exclude<Intent, "compare" | "llm">, string> = {
  transfer_timing: [
    "Factors that affect international transfer cost and timing:",
    "• Compare total cost — fee + FX rate spread, not just the headline fee.",
    "• Speed varies: same-day rails cost more; 1–3 day transfers are usually cheaper.",
    "• Large transfers can be more exposed to FX movement; splitting is one risk-management concept to understand.",
    "• Watch out for weekends and holidays — they delay settlement.",
  ].join("\n"),
  investing_basics: [
    "Factors that matter before investing:",
    "• Time horizon matters: short-term (<1 year) and long-term (5+ years) money have different risk needs.",
    "• Are you investing money you can afford not to touch for that period?",
    "• Index funds/ETFs spread risk across many companies — often a calmer starting point than single stocks.",
    "• Past performance doesn't predict future results.",
  ].join("\n"),
  risk_tolerance: [
    "Risk tolerance is personal — here's a frame to think about it:",
    "• Conservative: prioritizes preserving capital; bonds, savings, blue-chip dividend stocks.",
    "• Moderate: a mix of stocks and bonds; willing to ride out short-term dips.",
    "• Aggressive: heavier in stocks (and sometimes crypto); accepts large swings for higher long-term potential.",
    "A useful stress test is whether a large temporary drop would make you panic, stay calm, or need the money sooner.",
  ].join("\n"),
  diversification: [
    "Diversification means spreading risk so one bad bet doesn't sink the whole boat:",
    "• Across asset classes: stocks, bonds, cash, sometimes crypto/real estate.",
    "• Across sectors: tech, healthcare, energy, consumer goods.",
    "• Across geographies: U.S., international developed, emerging markets.",
    "• A common starter mix is a broad-market ETF + a bond ETF.",
  ].join("\n"),
  crypto: [
    "Crypto is a high-volatility asset class — important context:",
    "• Daily moves of 5–15% are normal; 30%+ swings happen.",
    "• Most people treat crypto as a small slice (often 1–10%) of their portfolio.",
    "• Custody matters: an exchange holding your coins ≠ you holding them in a wallet.",
    "• Tax treatment is different from stocks in many countries — check local rules.",
  ].join("\n"),
  budgeting: [
    "A simple way to think about cashflow:",
    "• 50% needs (rent, utilities, food, transport).",
    "• 30% wants (entertainment, dining, hobbies).",
    "• 20% savings + debt payoff.",
    "These ratios are starting points, not rules — adjust to your reality.",
  ].join("\n"),
  fallback: [
    "I can help you think through:",
    "• Transfer timing and FX considerations",
    "• Investing basics and risk levels",
    "• Diversification across assets",
    "• Crypto volatility context",
    "• Budgeting frameworks",
    "Try asking something like: \"What factors matter before investing $500?\"",
  ].join("\n"),
};

function fallbackCompare(assets: CompareAsset[]): string {
  const lines: string[] = ["Here's how these line up side-by-side:\n"];
  for (const a of assets) {
    lines.push(
      `• ${a.symbol} — ${a.name}`,
      `   ${labelClass(a.assetClass)} · ${a.riskLevel} risk` +
        (a.sector ? ` · ${a.sector}` : "") +
        ` · price $${a.price.toFixed(2)}`
    );
    if (a.description) lines.push(`   ${a.description}`);
  }
  lines.push(
    "",
    "How they differ:",
    "• Asset class drives behavior — stocks track single companies, ETFs spread across many, crypto follows its own market cycles.",
    "• Risk levels here range from " +
      [...new Set(assets.map((a) => a.riskLevel))].join(", ") +
      " — higher risk usually means bigger swings up AND down.",
    "• Role in a portfolio is different for each: some are diversifiers, some are concentrated bets.",
    "",
    "Both (or all) have a place — what matters is how each fits your goals and time horizon.",
  );
  return lines.join("\n");
}

function labelClass(c: string) {
  if (c === "etf") return "ETF";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/* ============================================================
   Public API.
   ============================================================ */

export type AiResponse = {
  content: string;
  intent: Intent;
  warnings: string[];
  /** Which backend served this answer. Useful for debug/UI. */
  source: "llm" | "fallback";
  /** Concrete provider used when source is "llm"; "none" when fallback served it. */
  provider: LlmProvider;
  /** Concrete provider model when available. */
  model: string | null;
};

export type AssistantContextMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type CompareAsset = {
  symbol: string;
  name: string;
  assetClass: string;
  sector: string | null;
  riskLevel: string;
  price: number;
  changePct: number;
  description: string | null;
};

/**
 * Generate a response to an open-ended user prompt.
 * Tries the LLM first; falls back to rule-based templates on any error.
 */
export async function generateResponse(
  prompt: string,
  warnings: string[] = [],
  context: AssistantContextMessage[] = []
): Promise<AiResponse> {
  const cfg = loadLlmConfig();

  if (isLlmConfigured(cfg)) {
    try {
      const messages: ChatMessage[] = [
        { role: "system", content: EDUCATOR_SYSTEM_PROMPT },
        ...context.slice(-8).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: prompt },
      ];
      const raw = await chat(messages, cfg);
      const safe = postCheck(raw);
      console.info(
        `[ai.generateResponse] source=llm provider=${cfg.provider} model=${cfg.model}`
      );
      return finalize(safe, "llm", warnings, "llm", cfg.provider, cfg.model);
    } catch (err) {
      console.error("[ai.generateResponse] LLM failed, falling back:", err);
      // fall through
    }
  }

  const intent = detectIntent(prompt);
  console.info("[ai.generateResponse] source=fallback provider=none");
  return finalize(
    fallbackResponse(prompt, intent, context),
    "fallback",
    warnings,
    intent
  );
}

/**
 * Compare 2-3 assets in education mode.
 */
export async function compareAssets(assets: CompareAsset[]): Promise<AiResponse> {
  const cfg = loadLlmConfig();

  if (isLlmConfigured(cfg)) {
    try {
      const userMsg = [
        `Please compare these assets in educational mode:`,
        ...assets.map(
          (a) =>
            `- ${a.symbol} (${a.name}): assetClass=${a.assetClass}, sector=${
              a.sector || "n/a"
            }, riskLevel=${a.riskLevel}, price=$${a.price.toFixed(
              2
            )}, dayChange=${a.changePct.toFixed(2)}%. ${a.description || ""}`
        ),
      ].join("\n");

      const raw = await chat(
        [
          { role: "system", content: COMPARATOR_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        cfg
      );
      const safe = postCheck(raw);
      console.info(
        `[ai.compareAssets] source=llm provider=${cfg.provider} model=${cfg.model}`
      );
      return finalize(safe, "llm", [], "compare", cfg.provider, cfg.model);
    } catch (err) {
      console.error("[ai.compareAssets] LLM failed, falling back:", err);
    }
  }

  console.info("[ai.compareAssets] source=fallback provider=none");
  return finalize(fallbackCompare(assets), "fallback", [], "compare");
}

/* ============================================================
   Helpers
   ============================================================ */

/** Re-check the LLM output against the same blocklist. */
function postCheck(content: string): string {
  const guard = checkGuardrails(content);
  if (guard.blocked) {
    return [
      "I drafted a reply but caught it crossing into direct advice, so I'm holding it back.",
      "",
      "I can offer education and risk-based insights, but I cannot give direct investment instructions or promise returns. Try rephrasing — for example: \"What factors matter when learning about tech stocks?\"",
    ].join("\n");
  }
  return content;
}

function fallbackResponse(
  prompt: string,
  intent: FallbackIntent,
  context: AssistantContextMessage[]
): string {
  const combined = `${context.map((m) => m.content).join(" ")} ${prompt}`.toLowerCase();
  const drawdownPct = extractDropPercent(prompt);
  const investmentAmount = extractDollarAmount(combined);

  if (
    (intent === "risk_tolerance" || intent === "investing_basics") &&
    drawdownPct != null
  ) {
    const drawdownDollars =
      investmentAmount != null ? (investmentAmount * drawdownPct) / 100 : null;
    const drawdownLine =
      investmentAmount != null && drawdownDollars != null
        ? `On $${investmentAmount.toLocaleString()}, a ${drawdownPct}% drop is about $${Math.round(
            drawdownDollars
          ).toLocaleString()}.`
        : `A ${drawdownPct}% drop is a useful concrete risk boundary to think with.`;

    return [
      `${drawdownLine} That sounds like a lower-to-moderate risk comfort level, not an aggressive one.`,
      "",
      "Educationally, a few concepts matter here:",
      "• Concentration risk: one volatile stock or crypto asset can swing much more than a diversified basket.",
      "• Broad ETFs usually spread company-specific risk better than single stocks.",
      "• Cash or lower-volatility assets reduce swings, but also reduce upside.",
      "• Rebalancing plans help investors define risk boundaries before market stress happens.",
      "",
      "The key lesson: risk tolerance is not just \"how much can I gain?\" It is \"what loss can I sit through without panic-selling?\"",
    ].join("\n");
  }

  if (
    intent === "investing_basics" &&
    /(don't|dont|do not|won't|wont|long[- ]?term|5\+|five years|not touch|leave .*invested)/.test(
      combined
    )
  ) {
    return [
      "If this is money you truly do not need to touch for several years, the conversation shifts from \"can I invest?\" to \"how much risk can I emotionally and financially handle?\"",
      "",
      "A useful beginner framework:",
      "• Emergency cash is separate from investing money in most financial planning frameworks.",
      "• Time horizon shapes risk: longer horizons can usually tolerate more short-term movement.",
      "• Diversification matters more than picking one perfect asset.",
      "• Contribution and rebalancing frequency affect how much market timing enters the process.",
      "",
      "A useful reflection question is: \"How would a 20-30% temporary drop affect my comfort and plans?\"",
    ].join("\n");
  }

  if (
    intent === "investing_basics" &&
    /(not sure|confused|beginner|new to investing|first time)/.test(combined)
  ) {
    return [
      "Since you are approaching this as a beginner, keep the first decision simple:",
      "",
      "• Separate money you need soon from money you can leave invested.",
      "• Learn the difference between a single stock and a broad ETF.",
      "• Expect prices to move down sometimes; that is normal market behavior.",
      "• Start by understanding risk, fees, and diversification before thinking about specific assets.",
      "",
      "The goal is not to find a perfect first trade. The goal is to understand what kind of risk you are taking.",
    ].join("\n");
  }

  return TEMPLATES[intent];
}

function extractDropPercent(prompt: string): number | null {
  const lower = prompt.toLowerCase();
  const match = lower.match(/(?:drop|drops|down|lose|loss|falls?|declines?)\D{0,20}(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const pct = Number(match[1]);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  return pct;
}

function extractDollarAmount(text: string): number | null {
  const dollarMatch = text.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);
  const plainMatch = text.match(/\b(?:invest|investing|risk)\D{0,20}(\d+(?:,\d{3})*(?:\.\d+)?)\b/);
  const raw = dollarMatch?.[1] || plainMatch?.[1];
  if (!raw) return null;
  const amount = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function finalize(
  content: string,
  source: "llm" | "fallback",
  warnings: string[],
  intent: Intent = source === "llm" ? "llm" : "fallback",
  provider: LlmProvider = "none",
  model: string | null = null
): AiResponse {
  const sections = [stripGeneratedDisclaimer(content)];
  if (warnings.length) {
    sections.push(warnings.map((w) => `⚠ ${w}`).join("\n"));
  }
  sections.push(`— ${DISCLAIMER}`);
  return {
    content: sections.join("\n\n"),
    intent,
    warnings,
    source,
    provider,
    model,
  };
}

function stripGeneratedDisclaimer(content: string) {
  const lines = content.split("\n");
  const filtered = lines.filter((line) => {
    const normalized = line
      .toLowerCase()
      .replace(/[—–-]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) return true;

    const looksLikeAdviceDisclaimer =
      normalized.includes("general financial education") ||
      normalized.includes("not personalized advice") ||
      normalized.includes("not financial advice") ||
      normalized.includes("licensed advisor") ||
      normalized.includes("financial advisor");

    return !looksLikeAdviceDisclaimer;
  });

  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
