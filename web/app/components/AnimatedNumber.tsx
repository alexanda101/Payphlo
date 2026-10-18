"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  /** Total animation duration in ms. */
  duration?: number;
  /** Format the displayed number. Defaults to `value.toFixed(decimals)`. */
  format?: (n: number) => string;
  decimals?: number;
  className?: string;
};

/**
 * Smoothly tweens a number from its previous value to the new one
 * using requestAnimationFrame. Falls back to instant updates if the
 * user prefers reduced motion.
 */
export function AnimatedNumber({
  value,
  duration = 600,
  format,
  decimals = 2,
  className,
}: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = value;
      rafRef.current = requestAnimationFrame(() => setDisplay(value));
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      };
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out (cubic)
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const text = format ? format(display) : display.toFixed(decimals);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {text}
    </span>
  );
}

/** Convenience: USD-formatted animated number. */
export function AnimatedMoney({
  value,
  duration = 600,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);
  return (
    <AnimatedNumber
      value={value}
      duration={duration}
      format={fmt}
      className={className}
    />
  );
}
