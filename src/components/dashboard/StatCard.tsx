import { ReactNode, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ title, value, change, icon, trend = "neutral" }: StatCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--y", `${e.clientY - rect.top}px`);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="panel-premium panel-premium-hover edge-glow spotlight overflow-hidden group"
    >
      <div className="p-4 sm:p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 sm:space-y-2 min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium uppercase tracking-[0.14em] truncate">
              {title}
            </p>
            <p className="num-display text-2xl sm:text-3xl lg:text-[2.25rem] font-semibold text-foreground leading-none">
              {value}
            </p>
            {change !== undefined && (
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium rounded-md px-1.5 py-0.5",
                  trend === "up" && "text-success bg-success/10 ring-1 ring-success/20",
                  trend === "down" && "text-destructive bg-destructive/10 ring-1 ring-destructive/20",
                  trend === "neutral" && "text-muted-foreground bg-muted/40 ring-1 ring-border/50"
                )}
              >
                {trend === "up" && <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                {trend === "down" && <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                {trend === "neutral" && <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                <span className="num-display font-semibold">
                  {change > 0 ? "+" : ""}
                  {change}%
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl shrink-0",
              "bg-gradient-to-br from-primary/25 via-primary/10 to-transparent",
              "border border-primary/30 text-primary",
              "shadow-[0_0_24px_-6px_hsl(var(--primary)/0.45)]",
              "transition-transform duration-300 group-hover:scale-[1.06]"
            )}
          >
            <div className="absolute inset-0 rounded-xl bg-primary/0 group-hover:bg-primary/5 transition-colors" />
            {icon}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
