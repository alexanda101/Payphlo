// Mock market data + paper trading engine.
// Prices drift deterministically per-symbol using a sine + jitter pattern,
// so re-quotes look "alive" without external APIs.

export type AssetSeed = {
  symbol: string;
  name: string;
  assetClass: "stock" | "etf" | "crypto";
  sector?: string;
  basePrice: number;
  riskLevel: "low" | "medium" | "high";
  description: string;
  volatility: number; // 0..1, drives jitter
};

export const ASSET_SEEDS: AssetSeed[] = [
  // ETFs (lower risk, broad market)
  {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    assetClass: "etf",
    sector: "Broad market",
    basePrice: 510.4,
    riskLevel: "low",
    description: "Tracks the S&P 500 — the 500 largest U.S. companies.",
    volatility: 0.15,
  },
  {
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    assetClass: "etf",
    sector: "Broad market",
    basePrice: 268.2,
    riskLevel: "low",
    description: "Owns nearly every U.S. publicly-traded stock.",
    volatility: 0.15,
  },
  {
    symbol: "AGG",
    name: "iShares Core U.S. Aggregate Bond ETF",
    assetClass: "etf",
    sector: "Bonds",
    basePrice: 98.7,
    riskLevel: "low",
    description: "Broad U.S. investment-grade bond market.",
    volatility: 0.05,
  },
  // Stocks
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    assetClass: "stock",
    sector: "Technology",
    basePrice: 218.3,
    riskLevel: "medium",
    description: "Consumer electronics, services, and software.",
    volatility: 0.3,
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    assetClass: "stock",
    sector: "Technology",
    basePrice: 442.1,
    riskLevel: "medium",
    description: "Software, cloud (Azure), enterprise services.",
    volatility: 0.28,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    assetClass: "stock",
    sector: "Semiconductors",
    basePrice: 132.5,
    riskLevel: "high",
    description: "GPUs and AI accelerators. High growth, high volatility.",
    volatility: 0.55,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    assetClass: "stock",
    sector: "Automotive",
    basePrice: 248.9,
    riskLevel: "high",
    description: "Electric vehicles and energy products.",
    volatility: 0.6,
  },
  {
    symbol: "JNJ",
    name: "Johnson & Johnson",
    assetClass: "stock",
    sector: "Healthcare",
    basePrice: 156.8,
    riskLevel: "low",
    description: "Diversified healthcare products and pharmaceuticals.",
    volatility: 0.15,
  },
  // Crypto
  {
    symbol: "BTC",
    name: "Bitcoin",
    assetClass: "crypto",
    sector: "Crypto",
    basePrice: 68420,
    riskLevel: "high",
    description: "The original cryptocurrency. Extremely volatile.",
    volatility: 0.75,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    assetClass: "crypto",
    sector: "Crypto",
    basePrice: 3210,
    riskLevel: "high",
    description: "Programmable blockchain. Extremely volatile.",
    volatility: 0.8,
  },
];

// Deterministic hash → number in [0,1)
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return (h % 100000) / 100000;
}

/**
 * Compute a "live" price for a symbol.
 * Combines:
 *  - basePrice
 *  - slow sine drift on a ~6h cycle (per-symbol phase)
 *  - small jitter that changes ~every 30s
 */
export function priceFor(
  basePrice: number,
  volatility: number,
  symbol: string,
  now = Date.now()
): number {
  const phase = hash(symbol) * Math.PI * 2;
  const drift = Math.sin(now / (1000 * 60 * 60 * 6) + phase) * volatility * 0.05;
  const bucket = Math.floor(now / 30000); // changes every 30s
  const jitter = (hash(symbol + bucket) - 0.5) * volatility * 0.01;
  return round2(basePrice * (1 + drift + jitter));
}

export function dayChange(
  basePrice: number,
  volatility: number,
  symbol: string
): { changeAbs: number; changePct: number } {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const current = priceFor(basePrice, volatility, symbol, now);
  const open = priceFor(basePrice, volatility, symbol, startOfDay.getTime());
  const changeAbs = round2(current - open);
  const changePct = round2((changeAbs / open) * 100);
  return { changeAbs, changePct };
}

/**
 * Sample N points of mock price history going back `hours` hours.
 * Used for sparkline charts on the frontend.
 */
export function priceHistory(
  basePrice: number,
  volatility: number,
  symbol: string,
  hours = 24,
  points = 48
): number[] {
  const now = Date.now();
  const span = hours * 60 * 60 * 1000;
  const step = span / (points - 1);
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = now - span + i * step;
    out.push(priceFor(basePrice, volatility, symbol, t));
  }
  return out;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
