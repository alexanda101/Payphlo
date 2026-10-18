// Mock transfer pricing engine.
// Designed to expose what other apps hide: mid-market rate, FX markup, true cost.

export type Corridor = {
  code: string; // e.g. "USD-NGN"
  fromCurrency: string;
  toCurrency: string;
  fromCountry: string;
  toCountry: string;
  flag: string; // emoji
  midMarketRate: number; // 1 fromCurrency = X toCurrency (Google rate)
  baseMarkupPct: number; // our standard markup
  symbol: string; // recipient currency symbol
};

// Hardcoded corridors. In production these come from an FX feed.
const CORRIDORS: Corridor[] = [
  {
    code: "USD-NGN",
    fromCurrency: "USD",
    toCurrency: "NGN",
    fromCountry: "United States",
    toCountry: "Nigeria",
    flag: "🇳🇬",
    midMarketRate: 1650.0,
    baseMarkupPct: 0.85,
    symbol: "₦",
  },
  {
    code: "USD-GHS",
    fromCurrency: "USD",
    toCurrency: "GHS",
    fromCountry: "United States",
    toCountry: "Ghana",
    flag: "🇬🇭",
    midMarketRate: 14.2,
    baseMarkupPct: 1.1,
    symbol: "₵",
  },
  {
    code: "USD-KES",
    fromCurrency: "USD",
    toCurrency: "KES",
    fromCountry: "United States",
    toCountry: "Kenya",
    flag: "🇰🇪",
    midMarketRate: 129.5,
    baseMarkupPct: 0.9,
    symbol: "KSh",
  },
  {
    code: "USD-PHP",
    fromCurrency: "USD",
    toCurrency: "PHP",
    fromCountry: "United States",
    toCountry: "Philippines",
    flag: "🇵🇭",
    midMarketRate: 58.4,
    baseMarkupPct: 0.7,
    symbol: "₱",
  },
  {
    code: "USD-MXN",
    fromCurrency: "USD",
    toCurrency: "MXN",
    fromCountry: "United States",
    toCountry: "Mexico",
    flag: "🇲🇽",
    midMarketRate: 19.85,
    baseMarkupPct: 0.6,
    symbol: "$",
  },
];

export type SpeedTier = "economy" | "standard" | "express";

const SPEED_CONFIG: Record<
  SpeedTier,
  { feeFlat: number; feePct: number; etaMinMin: number; etaMaxMin: number; label: string; description: string }
> = {
  economy: {
    feeFlat: 0,
    feePct: 0.5,
    etaMinMin: 60 * 24 * 1, // 1 day
    etaMaxMin: 60 * 24 * 3, // 3 days
    label: "Economy",
    description: "1–3 business days. Cheapest.",
  },
  standard: {
    feeFlat: 1.99,
    feePct: 0.5,
    etaMinMin: 60 * 4,
    etaMaxMin: 60 * 24,
    label: "Standard",
    description: "Within 24 hours. Best balance.",
  },
  express: {
    feeFlat: 4.99,
    feePct: 0.8,
    etaMinMin: 1,
    etaMaxMin: 30,
    label: "Express",
    description: "Minutes. Highest fee.",
  },
};

export function listCorridors() {
  // tiny pseudo-random "rate health" for the UI dot
  return CORRIDORS.map((c) => {
    const variance = pseudoVariance(c.code);
    let health: "good" | "average" | "poor";
    if (variance < -0.3) health = "good";
    else if (variance > 0.3) health = "poor";
    else health = "average";
    return {
      code: c.code,
      fromCurrency: c.fromCurrency,
      toCurrency: c.toCurrency,
      fromCountry: c.fromCountry,
      toCountry: c.toCountry,
      flag: c.flag,
      symbol: c.symbol,
      midMarketRate: c.midMarketRate,
      baseMarkupPct: c.baseMarkupPct,
      health,
      healthNote:
        health === "good"
          ? "Rates are favorable today"
          : health === "poor"
          ? "Rates are below 30-day average — consider waiting"
          : "Rates are near typical levels",
    };
  });
}

export function getCorridor(code: string): Corridor | undefined {
  return CORRIDORS.find((c) => c.code === code);
}

export function getSpeedTiers() {
  return Object.entries(SPEED_CONFIG).map(([key, v]) => ({
    code: key as SpeedTier,
    label: v.label,
    description: v.description,
    etaMinMin: v.etaMinMin,
    etaMaxMin: v.etaMaxMin,
  }));
}

export type QuoteBreakdown = {
  corridor: string;
  fromCurrency: string;
  toCurrency: string;
  sendAmount: number;
  midMarketRate: number;
  ourRate: number;
  markupPct: number;
  feeAmount: number;
  totalCost: number;
  receiveAmount: number;
  fxMarkupCost: number; // explicit money lost to FX spread
  speedTier: SpeedTier;
  deliveryEtaMin: number;
  deliveryEtaMax: number;
  expiresAtIso: string; // 10 minutes lock
};

export function buildQuote(params: {
  corridorCode: string;
  sendAmount: number;
  speedTier: SpeedTier;
}): QuoteBreakdown {
  const corridor = getCorridor(params.corridorCode);
  if (!corridor) throw new Error("Unknown corridor");

  const speed = SPEED_CONFIG[params.speedTier];
  if (!speed) throw new Error("Unknown speed tier");

  const sendAmount = round2(params.sendAmount);

  // small live-ish jitter so each quote feels alive (±0.2%)
  const rateJitter = 1 + (pseudoVariance(corridor.code + Date.now().toString().slice(0, -3)) * 0.004);
  const midMarketRate = round4(corridor.midMarketRate * rateJitter);

  const markupPct = round2(corridor.baseMarkupPct);
  const ourRate = round4(midMarketRate * (1 - markupPct / 100));

  const feePct = speed.feePct;
  const feeFlat = speed.feeFlat;
  const feeAmount = round2(feeFlat + sendAmount * (feePct / 100));

  const fxMarkupCost = round2(sendAmount * (markupPct / 100));
  const totalCost = round2(sendAmount + feeAmount);
  const receiveAmount = round2(sendAmount * ourRate);

  return {
    corridor: corridor.code,
    fromCurrency: corridor.fromCurrency,
    toCurrency: corridor.toCurrency,
    sendAmount,
    midMarketRate,
    ourRate,
    markupPct,
    feeAmount,
    totalCost,
    receiveAmount,
    fxMarkupCost,
    speedTier: params.speedTier,
    deliveryEtaMin: speed.etaMinMin,
    deliveryEtaMax: speed.etaMaxMin,
    expiresAtIso: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

// deterministic-ish pseudo variance from a seed string (no external deps)
function pseudoVariance(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  // map to -0.5 .. +0.5
  return ((hash % 1000) / 1000) - 0.5;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
