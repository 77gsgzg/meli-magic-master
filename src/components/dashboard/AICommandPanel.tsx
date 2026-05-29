import { motion } from "framer-motion";
import {
  Brain,
  Bot,
  RefreshCw,
  LineChart,
  Sparkles,
  ShieldAlert,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Signal {
  id: string;
  icon: React.ElementType;
  label: string;
  status: "active" | "syncing" | "idle" | "alert";
  meta: string;
  iconClass: string;
}

const SIGNALS: Signal[] = [
  { id: "auto",    icon: Bot,         label: "active_automations",  status: "active",  meta: "12 routines · uptime 99.98%", iconClass: "text-primary" },
  { id: "market",  icon: RefreshCw,   label: "market_sync",         status: "syncing", meta: "MLB feed · last_pull 12s",     iconClass: "text-info" },
  { id: "catalog", icon: Brain,       label: "catalog_intelligence",status: "active",  meta: "embeddings · 8.2k indexed",    iconClass: "text-primary" },
  { id: "listing", icon: Sparkles,    label: "listing_optimization",status: "active",  meta: "AI titles · 312 enhanced/24h", iconClass: "text-primary" },
  { id: "pricing", icon: LineChart,   label: "pricing_engine",      status: "active",  meta: "spread guard · stable",        iconClass: "text-success" },
  { id: "alerts",  icon: ShieldAlert, label: "operational_alerts",  status: "idle",    meta: "no incidents · watching",      iconClass: "text-muted-foreground" },
];

const statusClass: Record<Signal["status"], string> = {
  active:  "bg-success",
  syncing: "bg-info animate-pulse",
  idle:    "bg-muted-foreground/50",
  alert:   "bg-destructive",
};

export function AICommandPanel() {
  return (
    <div className="cinematic-panel edge-highlight ambient-noise overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-background/30">
        <div className="flex items-center gap-2.5">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <span className="mono-label">ruxov_ai / command</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="mono-label text-success">heartbeat</span>
        </div>
      </div>

      {/* Hero radar + state */}
      <div className="relative flex items-center gap-5 px-4 py-4">
        <div className="relative shrink-0">
          <div className="relative h-24 w-24 rounded-full border border-primary/30 flex items-center justify-center">
            <div className="absolute inset-2 rounded-full border border-primary/15" />
            <div className="absolute inset-5 rounded-full border border-primary/10" />
            <div className="absolute inset-0 radar-sweep opacity-80" />
            <Brain className="h-7 w-7 relative z-10 text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="mono-label mb-1">system_state</p>
          <p className="mono-data text-xl font-semibold text-success leading-tight">
            AI · ONLINE
          </p>
          <p className="terminal-text text-muted-foreground mt-1 truncate">
            6 modules · 0 incidents · latency 42ms
          </p>
        </div>
      </div>

      {/* Signals grid */}
      <div className="px-2 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
        {SIGNALS.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            className="group flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-primary/[0.05] transition-colors"
          >
            <s.icon className={cn("h-3.5 w-3.5 shrink-0", s.iconClass)} />
            <div className="flex-1 min-w-0">
              <p className="mono-label truncate text-foreground/80">{s.label}</p>
              <p className="terminal-text text-muted-foreground truncate">{s.meta}</p>
            </div>
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusClass[s.status])} />
          </motion.div>
        ))}
      </div>

      {/* Footer scan line */}
      <div className="border-t border-border/50 px-4 py-2 flex items-center justify-between bg-background/30">
        <span className="mono-label text-muted-foreground/70">scan_window · 24h</span>
        <span className="mono-data text-xs text-primary">▲ 1.4% efficiency</span>
      </div>
    </div>
  );
}
