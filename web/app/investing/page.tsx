"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import { AppShell } from "../components/AppShell";
import { Sparkline } from "../components/Sparkline";
import { AnimatedMoney } from "../components/AnimatedNumber";

type Asset = {
  symbol: string;
  name: string;
  assetClass: "stock" | "etf" | "crypto";
  sector: string | null;
  riskLevel: "low" | "medium" | "high";
  description: string | null;
  price: number;
  changeAbs: number;
  changePct: number;
  history: number[];
};
type Portfolio = {
  cashBalance: number;
  positionsValue: number;
  totalValue: number;
  positions: {
    symbol: string;
    name: string;
    quantity: number;
    avgCost: number;
    price: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPct: number;
  }[];
};

const CLASS_LABEL: Record<string, string> = {
  stock: "Stock",
  etf: "ETF",
  crypto: "Crypto",
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function InvestingPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [watchSymbols, setWatchSymbols] = useState<Set<string>>(new Set());
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [filter, setFilter] = useState<"all" | "stock" | "etf" | "crypto" | "watchlist">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      const [a, w, p] = await Promise.all([
        api.assets(),
        api.watchlist(),
        api.portfolio(),
      ]);
      setAssets(a.assets);
      setWatchSymbols(new Set(w.watchlist.map((x) => x.symbol)));
      setPortfolio(p);
      setError(null);
    } catch (e) {
      const apiErr = e as ApiError;
      if (apiErr.status === 401) {
        router.push("/login");
        return;
      }
      setError(apiErr.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleWatch(symbol: string) {
    const has = watchSymbols.has(symbol);
    const next = new Set(watchSymbols);
    if (has) next.delete(symbol); else next.add(symbol);
    setWatchSymbols(next);
    try {
      if (has) await api.removeWatch(symbol);
      else await api.addWatch(symbol);
    } catch (e) {
      setWatchSymbols(watchSymbols);
      setError((e as ApiError).message);
    }
  }

  const filtered = assets.filter((a) => {
    if (filter === "all") return true;
    if (filter === "watchlist") return watchSymbols.has(a.symbol);
    return a.assetClass === filter;
  });

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">Markets</p>
            <h1 className="text-3xl font-semibold tracking-tight">Invest</h1>
            <p className="mt-1 text-xs text-[var(--muted-2)]">
              Paper trading. Practice with virtual cash before real money.
            </p>
          </div>
          {portfolio && (
            <div className="card px-4 py-2 text-right">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                Portfolio
              </div>
              <div className="text-xl font-semibold">
                <AnimatedMoney value={portfolio.totalValue} />
              </div>
            </div>
          )}
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["all", "stock", "etf", "crypto", "watchlist"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                    filter === f
                      ? "bg-[var(--brand)] text-[#04130a]"
                      : "card text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {f === "watchlist" ? `★ Watchlist (${watchSymbols.size})` : f}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-sm text-[var(--muted)]">Loading markets…</p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((a) => {
                  const positive = a.changeAbs >= 0;
                  return (
                    <li
                      key={a.symbol}
                      className="card group flex items-center gap-3 p-3 transition hover:border-[var(--brand)]/40 hover:bg-[var(--surface-2)]"
                    >
                      <button
                        onClick={() => toggleWatch(a.symbol)}
                        className={`text-xl transition ${
                          watchSymbols.has(a.symbol)
                            ? "text-[var(--brand)]"
                            : "text-[var(--muted-2)] hover:text-[var(--brand)]"
                        }`}
                        title={watchSymbols.has(a.symbol) ? "Unwatch" : "Watch"}
                      >
                        {watchSymbols.has(a.symbol) ? "★" : "☆"}
                      </button>
                      <Link
                        href={`/investing/${a.symbol}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[10px] font-semibold tracking-tight">
                          {a.symbol.slice(0, 4)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{a.symbol}</span>
                            <span className="truncate text-xs text-[var(--muted)]">
                              {a.name}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10px]">
                            <span className="pill pill-brand">
                              {CLASS_LABEL[a.assetClass]}
                            </span>
                            <span className={`pill pill-${a.riskLevel}`}>
                              {a.riskLevel}
                            </span>
                          </div>
                        </div>

                        <div className="hidden sm:block">
                          <Sparkline values={a.history} width={88} height={32} />
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="font-medium">{money(a.price)}</div>
                          <div
                            className={`text-xs ${
                              positive ? "text-[var(--positive)]" : "text-[var(--negative)]"
                            }`}
                          >
                            {positive ? "+" : ""}
                            {a.changePct.toFixed(2)}%
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="card p-6 text-center text-sm text-[var(--muted)]">
                    {filter === "watchlist"
                      ? "No assets on your watchlist yet. Tap a ☆ to add one."
                      : "No assets in this category."}
                  </li>
                )}
              </ul>
            )}
          </section>

          <aside className="space-y-4">
            {portfolio && (
              <>
                <div className="card p-5">
                  <h2 className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    Portfolio value
                  </h2>
                  <p className="mt-1 text-3xl font-semibold">
                    <AnimatedMoney value={portfolio.totalValue} />
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="card-2 px-3 py-2">
                      <div className="text-[10px] uppercase text-[var(--muted)]">Cash</div>
                      <div className="font-medium">{money(portfolio.cashBalance)}</div>
                    </div>
                    <div className="card-2 px-3 py-2">
                      <div className="text-[10px] uppercase text-[var(--muted)]">Holdings</div>
                      <div className="font-medium">{money(portfolio.positionsValue)}</div>
                    </div>
                  </div>
                </div>

                <div className="card p-5">
                  <h2 className="mb-3 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    Holdings
                  </h2>
                  {portfolio.positions.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">
                      No positions yet. Pick a symbol to place your first paper trade.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {portfolio.positions.map((p) => {
                        const positive = p.unrealizedPnL >= 0;
                        return (
                          <li
                            key={p.symbol}
                            className="flex items-center justify-between text-sm"
                          >
                            <div>
                              <Link
                                href={`/investing/${p.symbol}`}
                                className="font-medium hover:text-[var(--brand)]"
                              >
                                {p.symbol}
                              </Link>
                              <div className="text-xs text-[var(--muted)]">
                                {p.quantity} @ {money(p.avgCost)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div>{money(p.marketValue)}</div>
                              <div
                                className={`text-xs ${
                                  positive ? "text-[var(--positive)]" : "text-[var(--negative)]"
                                }`}
                              >
                                {positive ? "+" : ""}
                                {p.unrealizedPnLPct.toFixed(2)}%
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <Link
                  href={`/assistant?prefill=${encodeURIComponent(
                    "How do portfolio risk levels work?"
                  )}`}
                  className="card flex items-center gap-3 p-4 text-sm hover:border-[var(--brand)]/40"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                    💡
                  </span>
                  <span className="text-[var(--muted)]">
                    Ask Phlo: learn how portfolio risk levels work.
                  </span>
                </Link>
              </>
            )}

            {error && <p className="text-sm text-[var(--negative)]">{error}</p>}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
