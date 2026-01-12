import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";

type OperationLog = Tables<'operation_logs'>;

const SecurityLogsPage = () => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('operation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setLogs(data as OperationLog[]);
      }
      setLoading(false);
    };

    fetchLogs();
  }, []);

  return (
    <DashboardLayout title="Logs de Segurança" subtitle="Validações de URL, OAuth e operações sensíveis.">
      <div className="space-y-4">
        <Card className="p-4 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum log encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm bg-background"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                      {log.entity_type && (
                        <span className="text-xs text-muted-foreground">
                          {log.entity_type}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  {log.error_message && (
                    <p className="text-xs text-destructive mt-1">{log.error_message}</p>
                  )}
                  {log.details && (
                    <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SecurityLogsPage;
