import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, AlertCircle, ShoppingBag } from "lucide-react";

interface PublicationLog {
  id: string;
  created_at: string;
  action: string;
  status: string;
  error_details: string | null;
  product_id: string;
}

interface ProductSummary {
  id: string;
  title: string;
}

export default function PublicationDiagnostics() {
  const { user, loading: authLoading } = useRequireAuth();
  const [logs, setLogs] = useState<PublicationLog[]>([]);
  const [products, setProducts] = useState<Record<string, ProductSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const { data: logData, error: logError } = await supabase
          .from("publication_history")
          .select("id, created_at, action, status, error_details, product_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (logError) {
          setError("Erro ao carregar logs de publicação");
          return;
        }

        setLogs(logData || []);

        const productIds = Array.from(new Set((logData || []).map((l) => l.product_id)));
        if (productIds.length) {
          const { data: productData } = await supabase
            .from("products")
            .select("id, title")
            .in("id", productIds);

          const map: Record<string, ProductSummary> = {};
          (productData || []).forEach((p) => {
            map[p.id] = p as ProductSummary;
          });
          setProducts(map);
        }
      } catch (err) {
        setError("Erro inesperado ao carregar diagnóstico de publicações");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  if (authLoading || loading) {
    return (
      <DashboardLayout
        title="Diagnóstico de Publicações"
        subtitle="Status e erros recentes de publicação no Mercado Livre"
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Diagnóstico de Publicações"
      subtitle="Use esta página para entender por que anúncios falharam ou ficaram em erro"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Últimas tentativas de publicação
            </CardTitle>
            <CardDescription>
              Lista consolidada das últimas ações de publicação, atualização ou remoção de anúncios
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive mb-4">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma publicação registrada ainda. Importe um produto e tente publicar para ver os logs aqui.
              </p>
            ) : (
              <div className="space-y-2 text-xs font-mono">
                {logs.map((log) => {
                  const product = products[log.product_id];
                  const isError = log.status !== "success";

                  return (
                    <div
                      key={log.id}
                      className="rounded-md border border-border/60 bg-muted/40 p-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{log.action}</Badge>
                          <Badge variant={isError ? "destructive" : "success"}>
                            {log.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-1 text-[11px] text-muted-foreground">
                        <ShoppingBag className="h-3 w-3" />
                        <span className="truncate max-w-xs">
                          {product?.title || `Produto ${log.product_id}`}
                        </span>
                      </div>

                      {log.error_details && (
                        <pre className="mt-1 text-[10px] leading-snug overflow-x-auto whitespace-pre-wrap break-all">
                          {log.error_details}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
