import Link from "next/link";
import { ReactNode } from "react";
import { Logo } from "./Logo";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Footer link to the opposite auth flow */
  altText: string;
  altHref: string;
  altCta: string;
};

export function AuthShell({
  title,
  subtitle,
  children,
  altText,
  altHref,
  altCta,
}: Props) {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[1fr_1fr]">
      {/* Left brand panel */}
      <aside className="bg-aurora hidden lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Link href="/"><Logo /></Link>

        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Money that{" "}
            <span className="bg-gradient-to-r from-[#00f293] to-[#00a35e] bg-clip-text text-transparent">
              moves with you.
            </span>
          </h2>
          <p className="mt-4 text-[var(--muted)]">
            Send. Invest. Ask. Three superpowers, one account, zero fluff.
          </p>

          <div className="mt-8 space-y-3">
            <Bullet text="Real mid-market rates with full cost breakdown" />
            <Bullet text="$10,000 in virtual cash to practice investing" />
            <Bullet text="Phlo explains, never prescribes" />
          </div>
        </div>

        <div className="text-xs text-[var(--muted-2)]">
          © {new Date().getFullYear()} Payphlo
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/"><Logo /></Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
          )}

          <div className="mt-7">{children}</div>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            {altText}{" "}
            <Link href={altHref} className="text-[var(--brand)] hover:underline">
              {altCta}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 text-sm text-[var(--foreground)]/90">
      <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </span>
      {text}
    </div>
  );
}
