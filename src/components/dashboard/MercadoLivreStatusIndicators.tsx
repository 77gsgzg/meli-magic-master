import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, RefreshCw, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

const ERROR_WINDOW_MINUTES = 15;
const PUBLICATION_WINDOW_HOURS = 1;

 type PublicationHistory = Tables<'publication_history'>;
 type OperationLog = Tables<'operation_logs'>;

export function MercadoLivreStatusIndicators() {
  const { user } = useAuth();
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
        supabase
          .from('publication_history')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'error')
          .gte('created_at', pubCutoff),
        supabase
          .from('operation_logs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'error')
          .gte('created_at', errCutoff),
        supabase
          .from('publication_history')
          .select<'created_at'>('created_at')
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      if (!pubErrorRes.error) {
        setPubFailures(pubErrorRes.count ?? 0);
      }
      if (!opErrorRes.error) {
        setIntegrationFailures(opErrorRes.count ?? 0);
      }
      if (!lastSuccessRes.error && lastSuccessRes.data && lastSuccessRes.data.length > 0) {
        setLastSuccessAt(lastSuccessRes.data[0].created_at as string);
      }
      setLoading(false);
    };

    loadStatus();

    const channel = supabase
      .channel('ml_integration_status')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'publication_history',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as PublicationHistory;
        const createdAt = new Date(row.created_at);
        const now = new Date();
        const pubCutoff = new Date(now.getTime() - PUBLICATION_WINDOW_HOURS * 60 * 60 * 1000);

        if (row.status === 'error' && createdAt >= pubCutoff) {
          setPubFailures((prev) => prev + 1);
        }
        if (row.status === 'success') {
          setLastSuccessAt(row.created_at as string);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'operation_logs',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as OperationLog;
        const createdAt = new Date(row.created_at);
        const now = new Date();
        const errCutoff = new Date(now.getTime() - ERROR_WINDOW_MINUTES * 60 * 1000);

        if (row.status === 'error' && createdAt >= errCutoff) {
          setIntegrationFailures((prev) => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const hasIncidents = pubFailures > 0 || integrationFailures > 0;

  return (
    <Card className="border border-border/60 bg-muted/40">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Saúde da Integração Mercado Livre
        </CardTitle>
        <Badge variant={hasIncidents ? "destructive" : "outline"} className="text-xs">
          {loading ? 'Carregando...' : hasIncidents ? 'Incidentes recentes' : 'Operacional'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-muted-foreground">Falhas de publicação (última hora)</span>
          </div>
          <span className="font-medium text-foreground">{pubFailures}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-warning" />
            <span className="text-muted-foreground">Erros de integração (últimos {ERROR_WINDOW_MINUTES} min)</span>
          </div>
          <span className="font-medium text-foreground">{integrationFailures}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-muted-foreground">Última publicação bem-sucedida</span>
          </div>
          <span className="font-medium text-foreground">
            {lastSuccessAt
              ? new Date(lastSuccessAt).toLocaleString()
              : 'Nenhuma ainda'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
