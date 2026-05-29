import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  className?: string;
  suffix?: string;
}

/**
 * Tween numeric values with a tabular-numeric reveal.
 * Falls back to raw string if `value` is not numeric.
 */
export function AnimatedCounter({ value, duration = 900, className, suffix = "" }: AnimatedCounterProps) {
  const numeric = typeof value === "number"
    ? value
    : Number(String(value).replace(/[^\d.-]/g, ""));
  const isNumeric = Number.isFinite(numeric);
  const [display, setDisplay] = useState(isNumeric ? 0 : value);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const to = numeric;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const current = from + (to - from) * eased;
      setDisplay(Number.isInteger(to) ? Math.round(current) : Number(current.toFixed(2)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [numeric, duration, isNumeric, value]);

  const formatted = typeof display === "number"
    ? display.toLocaleString("pt-BR")
    : display;

  return (
    <span className={className}>
      {formatted}
      {suffix}
    </span>
  );
}
