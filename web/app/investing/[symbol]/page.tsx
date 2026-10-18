"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { AppShell } from "../../components/AppShell";
import { AnimatedMoney } from "../../components/AnimatedNumber";
import { Sparkline } from "../../components/Sparkline";

type Detail = {
  symbol: string;
  name: string;
  assetClass: string;
  sector: string | null;
  riskLevel: string;
  description: string | null;
  price: number;
  changeAbs: number;
  changePct: number;
  history: number[];
};

type Position = {
  symbol: string;
  quantity: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
};

const RISK_BLURB: Record<string, string> = {
  low: "Generally steadier prices. Smaller swings, smaller upside.",
  medium: "Moderate ups and downs. Long-term growth with real short-term risk.",
  high: "Big swings in both directions. Only invest what you're prepared to lose.",
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function AssetDetailPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params?.symbol || "").toUpperCase();
  const router = useRouter();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [cash, setCash] = useState(0);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState<string>("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  async function load() {
    try {
      const [d, p] = await Promise.all([api.assetDetail(symbol), api.portfolio()]);
      setDetail(d.asset as Detail);
      setCash(p.cashBalance);
      const pos = p.positions.find((x) => x.symbol === symbol);
      setPosition(pos ? (pos as Position) : null);
      setError(null);
    } catch (e) {
      const apiErr = e as ApiError;
      if (apiErr.status === 401) {
        router.push("/login");
        return;
      }
      setError(apiErr.message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a positive quantity.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.placeOrder(symbol, side, qty);
      setSuccess(
        `${side === "buy" ? "Bought" : "Sold"} ${qty} ${symbol} at ${money(
          r.executedPrice
        )} (total ${money(r.total)})`
      );
      setQuantity("1");
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!detail) {
    return (
      <AppShell>
        <div className="p-6 text-sm text-[var(--muted)]">
          Loading {symbol}…
          {error && <p className="mt-2 text-[var(--negative)]">{error}</p>}
        </div>
      </AppShell>
    );
  }

  const qtyNum = Number(quantity) || 0;
  const estTotal = qtyNum * detail.price;
  const positive = detail.changeAbs >= 0;
  const canSubmit =
    qtyNum > 0 &&
    (side === "buy"
      ? estTotal <= cash
      : position !== null && qtyNum <= position.quantity);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/investing"
              className="text-xs text-[var(--muted)] hover:text-[var(--brand)]"
            >
              ← All markets
            </Link>
            <div className="mt-1 flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--surface-2)] text-xs font-semibold">
                {detail.symbol.slice(0, 4)}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {detail.symbol}
                </h1>
                <p className="truncate text-xs text-[var(--muted)]">{detail.name}</p>
              </div>
            </div>
          </div>
          <Link
            href={`/assistant?prefill=${encodeURIComponent(
              `Tell me about ${detail.symbol} (${detail.name}). What are the risks?`
            )}`}
            className="btn-ghost inline-flex items-center justify-center gap-2 w-full text-sm sm:w-auto"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v3"/><path d="M12 18v3"/>
              <path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/>
              <path d="M3 12h3"/><path d="M18 12h3"/>
              <path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Ask Phlo
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            {/* Price + chart */}
            <div className="card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="text-3xl font-semibold">
                    <AnimatedMoney value={detail.price} />
                  </div>
                  <div
                    className={`mt-1 text-sm ${
                      positive ? "text-[var(--positive)]" : "text-[var(--negative)]"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {detail.changeAbs.toFixed(2)} ({positive ? "+" : ""}
                    {detail.changePct.toFixed(2)}%) today
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="pill pill-brand">{detail.assetClass.toUpperCase()}</span>
                  <span className={`pill pill-${detail.riskLevel}`}>
                    {detail.riskLevel} risk
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <Sparkline
                  values={detail.history}
                  width={720}
                  height={150}
                  className="w-full"
                />
                <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-[var(--muted-2)]">
                  <span>24h ago</span>
                  <span>Now</span>
                </div>
              </div>

              {detail.description && (
                <p className="mt-5 text-sm text-[var(--muted)]">
                  {detail.description}
                </p>
              )}
              <div className="card-2 mt-4 px-4 py-3 text-xs text-[var(--muted)]">
                <strong className="capitalize text-[var(--foreground)]">
                  {detail.riskLevel} risk:
                </strong>{" "}
                {RISK_BLURB[detail.riskLevel]}
              </div>
            </div>

            {position && (
              <div className="card p-5">
                <h2 className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Your position
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label="Shares" value={String(position.quantity)} />
                  <Stat label="Avg cost" value={money(position.avgCost)} />
                  <Stat label="Value" value={money(position.marketValue)} />
                  <Stat
                    label="P&L"
                    value={`${money(position.unrealizedPnL)} (${position.unrealizedPnLPct.toFixed(2)}%)`}
                    accent={position.unrealizedPnL >= 0 ? "pos" : "neg"}
                  />
                </div>
              </div>
            )}
          </section>

          <aside>
            <form onSubmit={submit} className="card p-5">
              <h2 className="mb-3 text-sm font-semibold">Place paper order</h2>

              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSide("buy")}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    side === "buy"
                      ? "bg-[var(--brand)] text-[#04130a]"
                      : "card-2 text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => setSide("sell")}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    side === "sell"
                      ? "bg-[var(--negative)] text-white"
                      : "card-2 text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Sell
                </button>
              </div>

              <label className="label">Quantity</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input mt-1"
              />

              <div className="mt-4 space-y-2 text-xs">
                <Row label="Price (est.)" value={money(detail.price)} />
                <Row
                  label={`Estimated ${side === "buy" ? "cost" : "proceeds"}`}
                  value={money(estTotal)}
                  bold
                />
                <Row label="Cash available" value={money(cash)} />
                {side === "sell" && (
                  <Row
                    label="Shares available"
                    value={String(position?.quantity ?? 0)}
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className={`mt-5 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                  side === "buy"
                    ? "bg-[var(--brand)] text-[#04130a] hover:bg-[var(--brand-strong)]"
                    : "bg-[var(--negative)] text-white hover:opacity-90"
                }`}
              >
                {submitting ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
              </button>

              {!canSubmit && qtyNum > 0 && (
                <p className="mt-2 text-xs text-[var(--warn)]">
                  {side === "buy"
                    ? "Not enough cash for this order."
                    : "Not enough shares to sell."}
                </p>
              )}

              {error && <p className="mt-3 text-sm text-[var(--negative)]">{error}</p>}
              {success && (
                <p className="mt-3 text-sm text-[var(--positive)]">{success}</p>
              )}

              <p className="mt-4 text-[10px] uppercase tracking-wide text-[var(--muted-2)]">
                Paper trade · no real money
              </p>
            </form>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "pos" | "neg";
}) {
  const color =
    accent === "pos"
      ? "text-[var(--positive)]"
      : accent === "neg"
      ? "text-[var(--negative)]"
      : "";
  return (
    <div className="card-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-0.5 font-medium ${color}`}>{value}</div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={bold ? "text-right font-medium text-[var(--foreground)]" : "text-right text-[var(--foreground)]"}>
        {value}
      </span>
    </div>
  );
}
