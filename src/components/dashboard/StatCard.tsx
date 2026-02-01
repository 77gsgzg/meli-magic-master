import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  return (
    <Card variant="stat" className="animate-fade-in overflow-hidden">
      <CardContent className="p-4 sm:p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 sm:space-y-2 min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">
              {title}
            </p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tabular-nums tracking-tight">
              {value}
            </p>
            {change !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs sm:text-sm font-medium",
                  trend === "up" && "text-success",
                  trend === "down" && "text-destructive",
                  trend === "neutral" && "text-muted-foreground"
                )}
              >
                <span className={cn(
                  "flex items-center justify-center rounded-full p-0.5",
                  trend === "up" && "bg-success/20",
                  trend === "down" && "bg-destructive/20",
                  trend === "neutral" && "bg-muted"
                )}>
                  {trend === "up" && <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                  {trend === "down" && <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                  {trend === "neutral" && <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                </span>
                <span className="font-semibold">{change > 0 ? "+" : ""}{change}%</span>
                <span className="text-muted-foreground text-xs hidden xs:inline">vs mês anterior</span>
              </div>
            )}
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/25 text-primary shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}