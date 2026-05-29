import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, RefreshCw, Activity, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

const ERROR_WINDOW_MINUTES = 15;
const PUBLICATION_WINDOW_HOURS = 1;

type PublicationHistory = Tables<'publication_history'>;
type OperationLog = Tables<'operation_logs'>;

export function MercadoLivreStatusIndicators() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pubFailures, setPubFailures] = useState(0);
  const [integrationFailures, setIntegrationFailures] = useState(0);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadStatus = async () => {
      setLoading(true);
      const now = new Date();
      const pubCutoff = new Date(now.getTime() - PUBLICATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
      const errCutoff = new Date(now.getTime() - ERROR_WINDOW_MINUTES * 60 * 1000).toISOString();

      const [pubErrorRes, opErrorRes, lastSuccessRes] = await Promise.all([
        supabase.from('publication_history').select('id', { count: 'exact', head: true }).eq('status', 'error').gte('created_at', pubCutoff),
        supabase.from('operation_logs').select('id', { count: 'exact', head: true }).eq('status', 'error').gte('created_at', errCutoff),
        supabase.from('publication_history').select('created_at').eq('status', 'success').order('created_at', { ascending: false }).limit(1),
      ]);

      if (!pubErrorRes.error) setPubFailures(pubErrorRes.count ?? 0);
      if (!opErrorRes.error) setIntegrationFailures(opErrorRes.count ?? 0);
      if (!lastSuccessRes.error && lastSuccessRes.data?.length) {
        setLastSuccessAt((lastSuccessRes.data[0] as any).created_at as string);
      }
      setLoading(false);
    };

    loadStatus();

    const channel = supabase
      .channel('ml_integration_status')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'publication_history', filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as PublicationHistory;
        const createdAt = new Date(row.created_at);
        const pubCutoff = new Date(Date.now() - PUBLICATION_WINDOW_HOURS * 60 * 60 * 1000);
        if (row.status === 'error' && createdAt >= pubCutoff) setPubFailures((p) => p + 1);
        if (row.status === 'success') setLastSuccessAt(row.created_at as string);
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'operation_logs', filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as OperationLog;
        const createdAt = new Date(row.created_at);
        const errCutoff = new Date(Date.now() - ERROR_WINDOW_MINUTES * 60 * 1000);
        if (row.status === 'error' && createdAt >= errCutoff) setIntegrationFailures((p) => p + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const hasIncidents = pubFailures > 0 || integrationFailures > 0;
  const goToErrorLogs = () => navigate("/security-logs?status=error");

  const statusTone = loading
    ? { label: "scanning", dot: "" as const, color: "text-muted-foreground" }
    : hasIncidents
      ? { label: "incidents", dot: "err" as const, color: "text-destructive" }
      : { label: "nominal",   dot: "" as const, color: "text-success" };

  return (
    <div className="panel-premium overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-background/40">
        <div className="flex items-center gap-2.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="mono-label">ml_integration / radar</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("live-dot", statusTone.dot)} />
          <span className={cn("mono-label", statusTone.color)}>{statusTone.label}</span>
        </div>
      </div>

      {/* Radar visual */}
      <div className="relative px-4 pt-5 pb-2 flex items-center gap-5">
        <div className="relative shrink-0">
          <div className="relative h-20 w-20 rounded-full border border-primary/30 flex items-center justify-center">
            <div className="absolute inset-2 rounded-full border border-primary/15" />
            <div className="absolute inset-4 rounded-full border border-primary/10" />
            <div className="absolute inset-0 radar-ring opacity-80" />
            <Radar className={cn("h-6 w-6 relative z-10", hasIncidents ? "text-destructive" : "text-primary")} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="mono-label mb-1">system_state</p>
          <p className={cn("text-lg font-semibold tracking-tight num-display", statusTone.color)}>
            {loading ? "—" : hasIncidents ? "ALERT" : "OPERATIONAL"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {lastSuccessAt ? `last_ok · ${new Date(lastSuccessAt).toLocaleTimeString()}` : "no_signal_yet"}
          </p>
        </div>
      </div>

      {/* Metric rows */}
      <div className="px-2 pb-3 pt-2 space-y-1">
        <MetricRow
          icon={AlertCircle}
          iconClass="text-destructive"
          label="pub_failures / 1h"
          value={pubFailures}
          loading={loading}
          onClick={goToErrorLogs}
          highlight={pubFailures > 0}
        />
        <MetricRow
          icon={RefreshCw}
          iconClass="text-warning"
          label={`integration_errors / ${ERROR_WINDOW_MINUTES}m`}
          value={integrationFailures}
          loading={loading}
          onClick={goToErrorLogs}
          highlight={integrationFailures > 0}
        />
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
            <span className="mono-label truncate">last_publication_ok</span>
          </div>
          <span className="text-xs text-foreground/80 num-display truncate">
            {lastSuccessAt ? new Date(lastSuccessAt).toLocaleString() : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

interface MetricRowProps {
  icon: React.ElementType;
  iconClass: string;
  label: string;
  value: number;
  loading: boolean;
  onClick: () => void;
  highlight: boolean;
}

function MetricRow({ icon: Icon, iconClass, label, value, loading, onClick, highlight }: MetricRowProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: 2 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left transition-colors",
        "hover:bg-primary/[0.05]",
        highlight && "bg-destructive/[0.04]"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} />
        <span className="mono-label truncate">{label}</span>
      </div>
      <span className={cn("num-display text-sm font-semibold tabular-nums", highlight ? "text-destructive" : "text-foreground/80")}>
        {loading ? "…" : value.toString().padStart(2, "0")}
      </span>
    </motion.button>
  );
}
