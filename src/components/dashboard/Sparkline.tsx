import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  seed?: number;
  trend?: "up" | "down" | "neutral";
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Tiny deterministic sparkline — pure visual / decorative.
 * Generates a smooth path from a seeded pseudo-random walk.
 */
export function Sparkline({ seed = 7, trend = "neutral", className, width = 88, height = 28 }: SparklineProps) {
  const { path, areaPath } = useMemo(() => {
    const N = 14;
    let s = seed * 9301 + 49297;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const bias = trend === "up" ? 0.15 : trend === "down" ? -0.15 : 0;
    const points: number[] = [];
    let v = 0.5;
    for (let i = 0; i < N; i++) {
      v += (rand() - 0.5 + bias) * 0.2;
      v = Math.max(0.08, Math.min(0.92, v));
      points.push(v);
    }
    // ensure final direction matches trend
    if (trend === "up") points[N - 1] = Math.max(points[N - 1], points[0] + 0.15);
    if (trend === "down") points[N - 1] = Math.min(points[N - 1], points[0] - 0.15);

    const stepX = width / (N - 1);
    const toY = (p: number) => height - p * height;
    let d = `M 0 ${toY(points[0]).toFixed(2)}`;
    for (let i = 1; i < N; i++) {
      const x1 = (i - 0.5) * stepX;
      const y1 = toY((points[i - 1] + points[i]) / 2);
      const x = i * stepX;
      const y = toY(points[i]);
      d += ` Q ${x1.toFixed(2)} ${y1.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    const area = `${d} L ${width} ${height} L 0 ${height} Z`;
    return { path: d, areaPath: area };
  }, [seed, trend, width, height]);

  const stroke =
    trend === "up" ? "hsl(var(--success))" :
    trend === "down" ? "hsl(var(--destructive))" :
    "hsl(var(--primary))";

  const gradientId = `spark-${seed}-${trend}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
