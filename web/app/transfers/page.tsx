"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import { AppShell } from "../components/AppShell";

type Corridor = {
  code: string;
  fromCurrency: string;
  toCurrency: string;
  fromCountry: string;
  toCountry: string;
  flag: string;
  symbol: string;
  midMarketRate: number;
  baseMarkupPct: number;
  health: "good" | "average" | "poor";
  healthNote: string;
};
type SpeedTier = {
  code: "economy" | "standard" | "express";
  label: string;
  description: string;
  etaMinMin: number;
  etaMaxMin: number;
};
type Quote = {
  id: string;
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
  fxMarkupCost: number;
  speedTier: string;
  deliveryEtaMin: number;
  deliveryEtaMax: number;
  expiresAtIso: string;
};

const HEALTH_DOT: Record<Corridor["health"], string> = {
  good: "bg-[var(--positive)]",
  average: "bg-[var(--warn)]",
  poor: "bg-[var(--negative)]",
};

function formatEta(minMin: number, maxMin: number) {
  const fmt = (m: number) =>
    m < 60 ? `${m}m` : m < 60 * 24 ? `${Math.round(m / 60)}h` : `${Math.round(m / (60 * 24))}d`;
  return `${fmt(minMin)} – ${fmt(maxMin)}`;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function TransfersPage() {
  const router = useRouter();

  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [speedTiers, setSpeedTiers] = useState<SpeedTier[]>([]);
  const [corridorCode, setCorridorCode] = useState<string>("");
  const [speed, setSpeed] = useState<SpeedTier["code"]>("standard");
  const [amountStr, setAmountStr] = useState<string>("500");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .corridors()
      .then((r) => {
        setCorridors(r.corridors);
        setSpeedTiers(r.speedTiers);
        if (r.corridors.length) setCorridorCode(r.corridors[0].code);
      })
      .catch((e) => {
        const apiErr = e as ApiError;
        if (apiErr.status === 401) {
          router.push("/login");
          return;
        }
        setError(apiErr.message);
      });
  }, [router]);

  const corridor = useMemo(
    () => corridors.find((c) => c.code === corridorCode),
    [corridors, corridorCode]
  );

  useEffect(() => {
    setQuote(null);
    setConfirmedId(null);
    if (!corridorCode) return;
    const amt = parseFloat(amountStr);
    if (!amt || amt <= 0) return;

    const t = setTimeout(async () => {
      setLoadingQuote(true);
      setError(null);
      try {
        const r = await api.quote(corridorCode, amt, speed);
        setQuote(r.quote);
      } catch (e) {
        setError((e as ApiError).message);
      } finally {
        setLoadingQuote(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [corridorCode, amountStr, speed]);

  async function handleConfirm() {
    if (!quote || !recipientName.trim()) return;
    setConfirming(true);
    setError(null);
    try {
      const r = await api.confirmTransfer(quote.id, recipientName.trim());
      setConfirmedId(r.transfer.id);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setConfirming(false);
    }
  }

  if (confirmedId) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="card-2 w-full max-w-md space-y-4 p-7 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)] text-2xl">
              ✓
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Transfer queued</h2>
            <p className="text-sm text-[var(--muted)]">
              Reference: {confirmedId.slice(0, 8)}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-[var(--muted-2)]">
              Mock transfer · no real money moved
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Link href="/dashboard" className="btn-ghost text-sm">Dashboard</Link>
              <button
                onClick={() => {
                  setConfirmedId(null);
                  setQuote(null);
                  setRecipientName("");
                }}
                className="btn-brand text-sm"
              >
                Send another
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        <header>
          <p className="text-sm text-[var(--muted)]">Remittance</p>
          <h1 className="text-3xl font-semibold tracking-tight">Send money</h1>
          <p className="mt-1 text-xs text-[var(--muted-2)]">
            Transparent FX. No hidden markup.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-5">
            <div>
              <label className="label mb-2 block">Where are you sending?</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {corridors.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCorridorCode(c.code)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm transition ${
                      corridorCode === c.code
                        ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--surface-3)]"
                    }`}
                  >
                    <span className="text-2xl">{c.flag}</span>
                    <div className="flex-1">
                      <div className="font-medium">{c.toCountry}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {c.fromCurrency} → {c.toCurrency}
                      </div>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[c.health]}`} title={c.healthNote} />
                  </button>
                ))}
              </div>
              {corridor && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  <span className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${HEALTH_DOT[corridor.health]}`} />
                  {corridor.healthNote}
                </p>
              )}
            </div>

            <div>
              <label className="label mb-2 block">
                You send ({corridor?.fromCurrency || "USD"})
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="input text-3xl font-medium"
              />
            </div>

            <div>
              <label className="label mb-2 block">Speed</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {speedTiers.map((t) => (
                  <button
                    key={t.code}
                    onClick={() => setSpeed(t.code)}
                    className={`rounded-2xl border p-3 text-left text-xs transition ${
                      speed === t.code
                        ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--surface-3)]"
                    }`}
                  >
                    <div className="font-semibold text-[var(--foreground)]">{t.label}</div>
                    <div className="mt-1 text-[var(--muted)]">
                      {formatEta(t.etaMinMin, t.etaMaxMin)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label mb-2 block">Recipient name</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Mom (GTBank)"
                className="input"
              />
            </div>

            {corridor && (
              <Link
                href={`/assistant?prefill=${encodeURIComponent(
                  `What affects the cost and delivery timing for a ${corridor.fromCurrency} transfer to ${corridor.toCountry}?`
                )}`}
                className="card flex items-center gap-3 p-4 text-sm hover:border-[var(--brand)]/40"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] text-xs font-bold">P</span>
                <span className="text-[var(--muted)]">
                  Ask Phlo: learn what affects transfer cost and delivery timing.
                </span>
              </Link>
            )}
          </section>

          <section className="card-2 p-6">
            <h2 className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              What you&apos;ll pay
            </h2>
            <p className="mb-4 text-xs text-[var(--muted-2)]">
              Every cost broken out. Nothing hidden.
            </p>

            {loadingQuote && !quote && (
              <p className="text-sm text-[var(--muted)]">Calculating…</p>
            )}

            {quote && corridor && (
              <div className="space-y-4">
                <div className="space-y-1 border-b border-[var(--border)] pb-3">
                  <Row label="You send" value={formatMoney(quote.sendAmount, quote.fromCurrency)} bold />
                  <Row label="Transfer fee" value={`−${formatMoney(quote.feeAmount, quote.fromCurrency)}`} muted />
                  <Row
                    label={`FX markup (${quote.markupPct}%)`}
                    value={`−${formatMoney(quote.fxMarkupCost, quote.fromCurrency)}`}
                    muted
                  />
                </div>

                <div className="space-y-1 border-b border-[var(--border)] pb-3 text-xs text-[var(--muted)]">
                  <Row
                    label="Mid-market rate"
                    value={`1 ${quote.fromCurrency} = ${quote.midMarketRate.toLocaleString()} ${quote.toCurrency}`}
                    small
                  />
                  <Row
                    label="Our rate"
                    value={`1 ${quote.fromCurrency} = ${quote.ourRate.toLocaleString()} ${quote.toCurrency}`}
                    small
                  />
                </div>

                <div className="rounded-2xl bg-[var(--brand-soft)] p-4">
                  <div className="text-[10px] uppercase tracking-wide text-[var(--brand)]">
                    Recipient gets
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {corridor.symbol}
                    {quote.receiveAmount.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Arrives in {formatEta(quote.deliveryEtaMin, quote.deliveryEtaMax)}
                  </div>
                </div>

                <Row
                  label="Total charged"
                  value={formatMoney(quote.totalCost, quote.fromCurrency)}
                  bold
                />

                <p className="text-[11px] text-[var(--muted-2)]">
                  Quote locked until{" "}
                  {new Date(quote.expiresAtIso).toLocaleTimeString()}
                </p>

                <button
                  onClick={handleConfirm}
                  disabled={confirming || !recipientName.trim()}
                  className="btn-brand w-full disabled:opacity-50"
                >
                  {confirming
                    ? "Confirming…"
                    : !recipientName.trim()
                    ? "Add recipient name to continue"
                    : `Send ${formatMoney(quote.totalCost, quote.fromCurrency)}`}
                </button>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-[var(--negative)]">{error}</p>}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  small,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${small ? "text-xs" : "text-sm"}`}>
      <span className={muted ? "text-[var(--muted)]" : "text-[var(--muted)]"}>{label}</span>
      <span className={bold ? "text-right font-semibold text-[var(--foreground)]" : "text-right text-[var(--foreground)]"}>{value}</span>
    </div>
  );
}
