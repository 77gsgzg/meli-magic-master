import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { useRequireAuth } from "@/hooks/useAuth";
import { Loader2, RefreshCw, AlertCircle, Shield, Clock, Activity } from "lucide-react";

interface MlDiagnosticsResponse {
  connected: boolean;
  nickname: string | null;
  seller_id: string | null;
  expires_at: string | null;
  is_expired: boolean | null;
  last_refresh: string | null;
  logs: Array<{
    created_at: string;
    operation_type: string;
    status: string;
    details: unknown;
  }>;
}

export default function MercadoLivreDiagnostics() {
  const { loading: authLoading } = useRequireAuth();
  const { getDiagnostics } = useMercadoLivre();
  const [diag, setDiag] = useState<MlDiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getDiagnostics();
        setDiag(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar diagnóstico");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getDiagnostics]);

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Diagnóstico Mercado Livre" subtitle="Status detalhado da conexão OAuth">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Diagnóstico Mercado Livre"
      subtitle="Use esta página apenas para suporte e investigação de problemas"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Visão geral da conexão
            </CardTitle>
            <CardDescription>
              Informações internas sobre tokens e histórico de operações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {diag && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status da conexão</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={diag.connected ? "success" : "outline"}>
                      {diag.connected ? "Conectado" : "Não conectado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground break-all">
                    {diag.nickname || diag.seller_id || "Sem dados de conta"}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Expiração do token</p>
                  {diag.expires_at ? (
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>{new Date(diag.expires_at).toLocaleString()}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem registro</p>
                  )}
                  {diag.is_expired != null && (
                    <p className="text-xs text-muted-foreground">
                      Situação: {diag.is_expired ? "Expirado" : "Válido"}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Última renovação</p>
                  {diag.last_refresh ? (
                    <div className="flex items-center gap-2 text-xs">
                      <RefreshCw className="h-3 w-3 text-muted-foreground" />
                      <span>{new Date(diag.last_refresh).toLocaleString()}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma renovação registrada</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Últimas operações registradas
            </CardTitle>
            <CardDescription>
              Log interno de ações relacionadas ao Mercado Livre (import, publish, token_refresh, delete)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {diag && diag.logs && diag.logs.length > 0 ? (
              <div className="space-y-2 text-xs font-mono">
                {diag.logs.map((log, idx) => (
                  <div
                    key={`${log.created_at}-${idx}`}
                    className="rounded-md border border-border/60 bg-muted/40 p-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{log.operation_type}</Badge>
                        <Badge
                          variant={log.status === 'success' ? 'success' : 'destructive'}
                        >
                          {log.status}
                        </Badge>
                      </div>
                    </div>
                    <pre className="text-[10px] leading-snug overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(log.details ?? {}, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum log recente encontrado para esta conexão.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
