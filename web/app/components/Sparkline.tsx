"use client";

import { useId } from "react";

type Props = {
  values: number[];
  width?: number;
  height?: number;
  /** Color override; otherwise derived from net change. */
  color?: string;
  /** If false, no fill area is drawn. */
  filled?: boolean;
  className?: string;
};

export function Sparkline({
  values,
  width = 120,
  height = 36,
  color,
  filled = true,
  className = "",
}: Props) {
  const rawId = useId();
  const fillId = `spark-fill-${rawId.replace(/:/g, "")}`;

  if (!values || values.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y] as const;
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`)
    .join(" ");

  const areaPath = `${path} L${points[points.length - 1][0].toFixed(
    2
  )},${(height - pad).toFixed(2)} L${points[0][0].toFixed(2)},${(
    height - pad
  ).toFixed(2)} Z`;

  const positive = values[values.length - 1] >= values[0];
  const stroke = color || (positive ? "var(--positive)" : "var(--negative)");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      {filled && (
        <>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${fillId})`} className="spark-area" />
        </>
      )}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="spark-draw"
      />
    </svg>
  );
}
