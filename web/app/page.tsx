import Link from "next/link";
import { Logo } from "./components/Logo";

export default function Home() {
  return (
    <div className="bg-aurora min-h-screen w-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-[var(--muted)] md:flex">
          <a href="#features" className="hover:text-[var(--foreground)]">Features</a>
          <a href="#how" className="hover:text-[var(--foreground)]">How it works</a>
          <a href="#trust" className="hover:text-[var(--foreground)]">Trust</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost text-sm">Log in</Link>
          <Link href="/signup" className="btn-brand text-sm">Get started</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12 md:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="pill pill-brand">New · Meet Phlo</span>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Money that{" "}
              <span className="bg-gradient-to-r from-[#00f293] to-[#00a35e] bg-clip-text text-transparent">
                moves with you.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[var(--muted)]">
              Send money home, invest with confidence, and get plain-English
              guidance from Phlo, your plain-English money guide. One app. Zero
              fluff.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-brand">
                Create free account →
              </Link>
              <Link href="/login" className="btn-ghost">I already have one</Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs text-[var(--muted-2)]">
              <span>✓ No card required</span>
              <span>✓ $10,000 paper-trading cash</span>
              <span>✓ 5 corridors live</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 bg-aurora rounded-[28px] opacity-70 blur-2xl" />
            <div className="card-2 relative overflow-hidden p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Portfolio value
                  </div>
                  <div className="mt-1 text-3xl font-semibold">$12,847.21</div>
                  <div className="mt-1 text-sm text-[var(--positive)]">
                    +$284.30 (+2.26%) today
                  </div>
                </div>
                <span className="pill pill-brand">LIVE</span>
              </div>

              <svg viewBox="0 0 320 110" className="mt-4 w-full">
                <defs>
                  <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d97e" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#00d97e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,80 C30,75 50,60 80,55 C115,49 140,70 170,60 C205,48 230,30 265,28 C295,26 310,20 320,15 L320,110 L0,110 Z"
                  fill="url(#hero-fill)"
                />
                <path
                  d="M0,80 C30,75 50,60 80,55 C115,49 140,70 170,60 C205,48 230,30 265,28 C295,26 310,20 320,15"
                  fill="none"
                  stroke="#00d97e"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { s: "AAPL", p: "+1.4%" },
                  { s: "BTC", p: "+3.2%" },
                  { s: "VOO", p: "+0.6%" },
                ].map((x) => (
                  <div key={x.s} className="card px-3 py-2">
                    <div className="text-xs text-[var(--muted)]">{x.s}</div>
                    <div className="text-sm text-[var(--positive)]">{x.p}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">
          Three superpowers, one account.
        </h2>
        <p className="mt-2 max-w-xl text-[var(--muted)]">
          Built for people who want their money to work harder — without a
          finance degree.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <FeatureCard
            tag="Send"
            title="Remittance done right."
            body="Real mid-market rate. See the markup, the fee, and the receive amount before you confirm. No surprises."
          />
          <FeatureCard
            tag="Invest"
            title="Practice before you risk."
            body="Start with $10,000 in virtual cash. Buy stocks, ETFs, and crypto fractions. Learn the swings without learning the hard way."
          />
          <FeatureCard
            tag="Ask"
            title="Phlo explains money clearly."
            body={`"What affects transfer costs?" "What's an ETF?" Phlo explains, never prescribes.`}
          />
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">
          Up and running in 60 seconds.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Step n={1} title="Create account" body="Email + password. That's it." />
          <Step n={2} title="Pick a corridor or a stock" body="USD → NGN, KES, MXN, INR, PHP. Or buy your first share." />
          <Step n={3} title="Ask Phlo" body="Curious? Confused? Phlo explains in plain English — never gives advice, always gives clarity." />
        </div>
      </section>

      <section id="trust" className="mx-auto max-w-6xl px-6 py-16">
        <div className="card-2 grid gap-6 p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">
              Built carefully. Built honestly.
            </h3>
            <p className="mt-2 text-[var(--muted)]">
              Paper trading uses deterministic mock prices today. Money
              movement is gated behind real partners (coming). Phlo is
              guard-railed against bad financial advice — it explains, never
              prescribes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="pill pill-brand">Phlo guardrails</span>
            <span className="pill pill-low">Atomic trades</span>
            <span className="pill pill-medium">Quote locks 10 min</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-[var(--muted)] md:flex-row">
          <Logo size={22} />
          <span>© {new Date().getFullYear()} Payphlo. All rights reserved.</span>
          <span className="text-[var(--muted-2)]">Built with care.</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  tag,
  title,
  body,
}: {
  tag: string;
  title: string;
  body: string;
}) {
  return (
    <div className="card group p-6 transition hover:border-[var(--brand)]/40">
      <span className="pill pill-brand">{tag}</span>
      <h3 className="mt-3 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="card p-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)] font-semibold">
        {n}
      </div>
      <h4 className="mt-3 text-lg font-semibold tracking-tight">{title}</h4>
      <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}
