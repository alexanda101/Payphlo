"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Logo } from "./Logo";
import { api } from "../../lib/api";

type NavItem = { href: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: <IconHome /> },
  { href: "/investing", label: "Invest", icon: <IconChart /> },
  { href: "/transfers", label: "Send", icon: <IconSend /> },
  { href: "/assistant", label: "Phlo", icon: <IconSpark /> },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();

  function handleLogout() {
    void api.logout().finally(() => router.push("/login"));
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6">
        <Link href="/dashboard" className="px-2">
          <Logo />
        </Link>

        <SidebarNav pathname={pathname} />

        <button
          onClick={handleLogout}
          className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <span className="grid h-7 w-7 place-items-center"><IconLogout /></span>
          <span className="font-medium">Log out</span>
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <Link href="/dashboard"><Logo size={24} /></Link>
          <button
            onClick={handleLogout}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Log out
          </button>
        </header>

        {/* Parallax wrapper: re-keys on route change so animation re-runs.
            Outer = "deep" layer (slower, longer travel).
            Inner = "front" layer (faster, shorter travel). */}
        <main key={pathname} className="page-deep min-w-0 flex-1">
          <div className="page-front h-full">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden sticky bottom-0 grid grid-cols-4 border-t border-[var(--border)] bg-[var(--surface)]">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2 text-[10px] uppercase tracking-wide transition-colors ${
                  active ? "text-[var(--brand)]" : "text-[var(--muted)]"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* -------- Sidebar with sliding pill -------- */
function SidebarNav({ pathname }: { pathname: string }) {
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const pillRef = useRef<HTMLSpanElement | null>(null);

  const syncPill = useCallback(() => {
    const pill = pillRef.current;
    if (!pill) return;

    const idx = NAV.findIndex((n) => isActive(pathname, n.href));
    if (idx < 0) {
      pill.style.opacity = "0";
      return;
    }

    const el = itemsRef.current[idx];
    if (!el) return;
    pill.style.setProperty("--nav-pill-y", `${el.offsetTop}px`);
    pill.style.setProperty("--nav-pill-h", `${el.offsetHeight}px`);
    pill.style.opacity = "1";
  }, [pathname]);

  useLayoutEffect(() => {
    syncPill();
  }, [syncPill]);

  useEffect(() => {
    window.addEventListener("resize", syncPill);
    return () => window.removeEventListener("resize", syncPill);
  }, [syncPill]);

  return (
    <nav className="relative mt-8 flex-1">
      <span
        ref={pillRef}
        aria-hidden
        className="nav-pill"
      />
      <div className="relative space-y-1">
        {NAV.map((item, i) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={(el) => {
                itemsRef.current[i] = el;
              }}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "text-[var(--brand)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <span className="grid h-7 w-7 place-items-center">
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ------- Inline icons (no extra deps) ------- */
function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>
  );
}
function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 16l4-4 3 3 5-7"/></svg>
  );
}
function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
  );
}
function IconSpark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3"/><path d="M12 18v3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>
  );
}
function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
  );
}
