import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Clock, Sparkles, Package, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type OperationLog = Tables<'operation_logs'>;

const iconMap: Record<string, { icon: React.ElementType; color: string }> = {
  import: { icon: Package, color: "text-primary" },
  publish: { icon: CheckCircle2, color: "text-success" },
  update: { icon: RefreshCw, color: "text-warning" },
  delete: { icon: AlertCircle, color: "text-destructive" },
  token_refresh: { icon: RefreshCw, color: "text-muted-foreground" },
  ai_optimization: { icon: Sparkles, color: "text-primary" },
};

const statusIcon: Record<string, { icon: React.ElementType; color: string }> = {
  success: { icon: CheckCircle2, color: "text-success" },
  error: { icon: AlertCircle, color: "text-destructive" },
  pending: { icon: Clock, color: "text-warning" },
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

      if (!error && data) {
        setActivities(data);
      }
      setLoading(false);
    };

    fetchActivities();

    // Subscribe to real-time updates
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getActivityMessage = (log: OperationLog): string => {
    const baseMessage = operationLabels[log.operation_type] || log.operation_type;
    if (log.status === 'error' && log.error_message) {
      return `${baseMessage} - ${log.error_message}`;
    }
    return baseMessage;
  };

  const getIcon = (log: OperationLog) => {
    if (log.status === 'error') {
      return statusIcon.error;
    }
    if (log.status === 'pending') {
      return statusIcon.pending;
    }
    return iconMap[log.operation_type] || statusIcon.success;
  };

  if (loading) {
    return (
      <Card variant="glass" className="animate-fade-in">
        <CardHeader>
          <CardTitle className="text-lg">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="h-5 w-5 rounded bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glass" className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-lg">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma atividade ainda
          </p>
        ) : (
          activities.map((activity) => {
            const { icon: Icon, color } = getIcon(activity);
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={cn("mt-0.5", color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">
                    {getActivityMessage(activity)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(activity.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
