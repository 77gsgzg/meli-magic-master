import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Clock, Sparkles, Package, RefreshCw, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type OperationLog = Tables<'operation_logs'>;

const iconMap: Record<string, { icon: React.ElementType; color: string; tag: string }> = {
  import:          { icon: Package,       color: "text-primary",          tag: "IMPORT" },
  publish:         { icon: CheckCircle2,  color: "text-success",          tag: "PUBLISH" },
  update:          { icon: RefreshCw,     color: "text-warning",          tag: "UPDATE" },
  delete:          { icon: AlertCircle,   color: "text-destructive",      tag: "DELETE" },
  token_refresh:   { icon: RefreshCw,     color: "text-muted-foreground", tag: "AUTH" },
  ai_optimization: { icon: Sparkles,      color: "text-primary",          tag: "AI" },
};

const statusIcon: Record<string, { icon: React.ElementType; color: string; tag: string }> = {
  success: { icon: CheckCircle2, color: "text-success",     tag: "OK" },
  error:   { icon: AlertCircle,  color: "text-destructive", tag: "ERR" },
  pending: { icon: Clock,        color: "text-warning",     tag: "WAIT" },
};

const operationLabels: Record<string, string> = {
  import: "Produto importado",
  publish: "Produto publicado",
  update: "Produto atualizado",
  delete: "Produto removido",
  token_refresh: "Token renovado",
  ai_optimization: "Otimização IA",
};

export function ActivityFeed() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchActivities = async () => {
      const { data, error } = await supabase
        .from('operation_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) setActivities(data);
      setLoading(false);
    };

    fetchActivities();

    const channel = supabase
      .channel('operation_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'operation_logs',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          setActivities(prev => [payload.new as OperationLog, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const getActivityMessage = (log: OperationLog): string => {
    const baseMessage = operationLabels[log.operation_type] || log.operation_type;
    if (log.status === 'error' && log.error_message) {
      return `${baseMessage} — ${log.error_message}`;
    }
    return baseMessage;
  };

  const getMeta = (log: OperationLog) => {
    if (log.status === 'error')   return statusIcon.error;
    if (log.status === 'pending') return statusIcon.pending;
    return iconMap[log.operation_type] || statusIcon.success;
  };

  return (
    <div className="panel-premium scanlines overflow-hidden animate-fade-in">
      {/* Terminal-style header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-background/40">
        <div className="flex items-center gap-2.5">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <span className="mono-label">intelligence_feed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="mono-label text-success">live</span>
        </div>
      </div>

      <div className="px-2 py-2 max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="space-y-2 px-2 py-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <div className="h-4 w-4 rounded skeleton-shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded skeleton-shimmer" />
                  <div className="h-2 w-1/4 rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="mono-label mb-1">no_signal</p>
            <p className="text-xs text-muted-foreground">Aguardando primeira operação…</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            <AnimatePresence initial={false}>
              {activities.map((activity) => {
                const { icon: Icon, color, tag } = getMeta(activity);
                return (
                  <motion.li
                    key={activity.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    className="group relative flex items-start gap-3 px-3 py-2.5 hover:bg-primary/[0.04] transition-colors"
                  >
                    <span className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/0 to-transparent group-hover:via-primary/60 transition-colors" />
                    <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn("mono-label", color)}>{tag}</span>
                        <span className="mono-label text-muted-foreground/60">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: false, locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-snug line-clamp-2">
                        {getActivityMessage(activity)}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
