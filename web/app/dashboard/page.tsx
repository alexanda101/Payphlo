"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../lib/api";
import { AppShell } from "../components/AppShell";
import { AnimatedMoney } from "../components/AnimatedNumber";

type Me = { id: string; name: string | null; email: string; createdAt: string };
type RecentTransfer = {
  id: string;
  status: string;
  recipientName: string;
  createdAt: string;
  quote: {
    fromCurrency: string;
    toCurrency: string;
    sendAmount: number;
    receiveAmount: number;
  };
};
type PortfolioSummary = {
  cashBalance: number;
  positionsValue: number;
  totalValue: number;
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [transfers, setTransfers] = useState<RecentTransfer[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        router.push("/login");
      });
    api
      .listTransfers()
      .then((r) => setTransfers(r.transfers.slice(0, 5)))
      .catch(() => {});
    api
      .portfolio()
      .then((p) =>
        setPortfolio({
          cashBalance: p.cashBalance,
          positionsValue: p.positionsValue,
          totalValue: p.totalValue,
        })
      )
      .catch(() => {});
  }, [router]);

  const greetingName = user?.name || user?.email?.split("@")[0] || "there";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-8 p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">Welcome back</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Hey, <span className="text-[var(--brand)]">{greetingName}</span>.
            </h1>
          </div>
          {portfolio && (
            <div className="card px-4 py-2 text-right">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                Total wealth
              </div>
              <div className="text-xl font-semibold">
                <AnimatedMoney value={portfolio.totalValue} />
              </div>
            </div>
          )}
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Tile
            href="/transfers"
            label="Send money"
            sub="5 corridors live"
            accent
            iconPaths={["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"]}
          />
          <Tile
            href="/investing"
            label="Invest"
            sub={
              portfolio
                ? `${money(portfolio.totalValue)} portfolio`
                : "Start paper trading"
            }
            iconPaths={["M4 19V5", "M4 19h16", "M7 16l4-4 3 3 5-7"]}
          />
          <Tile
            href="/assistant"
            label="Ask Phlo"
            sub="Plain-English answers"
            iconPaths={["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"]}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--muted)]">
                Investing snapshot
              </h2>
              <Link
                href="/investing"
                className="text-xs text-[var(--brand)] hover:underline"
              >
                Open →
              </Link>
            </div>
            {portfolio ? (
              <>
                <p className="mt-3 text-3xl font-semibold">
                  <AnimatedMoney value={portfolio.totalValue} />
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Cash" value={money(portfolio.cashBalance)} />
                  <Stat label="Holdings" value={money(portfolio.positionsValue)} />
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
            )}
          </section>

          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--muted)]">
                Recent transfers
              </h2>
              <Link
                href="/transfers"
                className="text-xs text-[var(--brand)] hover:underline"
              >
                Send →
              </Link>
            </div>
            {transfers.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No transfers yet. Send your first one →
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {transfers.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <div className="font-medium">{t.recipientName}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {new Date(t.createdAt).toLocaleDateString()} ·{" "}
                        <span className="capitalize">{t.status}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div>
                        {t.quote.fromCurrency} {t.quote.sendAmount.toFixed(2)}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        → {t.quote.toCurrency}{" "}
                        {t.quote.receiveAmount.toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {user && (
          <p className="text-xs text-[var(--muted-2)]">
            Signed in as {user.email} · Joined{" "}
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Tile({
  href,
  label,
  sub,
  iconPaths,
  accent,
}: {
  href: string;
  label: string;
  sub: string;
  iconPaths: string[];
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`card group flex items-start gap-4 p-5 transition hover:border-[var(--brand)]/40 hover:bg-[var(--surface-2)] ${
        accent ? "ring-1 ring-[var(--brand)]/30" : ""
      }`}
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {iconPaths.map((d, i) => <path key={i} d={d} />)}
        </svg>
      </span>
      <span className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-[var(--muted)]">{sub}</div>
      </span>
      <span className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand)]">→</span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
