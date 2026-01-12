import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

 type PublicationHistory = Tables<'publication_history'>;
 type OperationLog = Tables<'operation_logs'>;

const DEFAULT_DAYS = 7;

export function MercadoLivrePanel() {
  const [fromDays, setFromDays] = useState<number>(DEFAULT_DAYS);
  const [filterType, setFilterType] = useState<"all" | "publication" | "integration">("all");
  const [pub, setPub] = useState<PublicationHistory[]>([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date();
      const cutoff = new Date(now.getTime() - fromDays * 24 * 60 * 60 * 1000).toISOString();

      const [pubRes, logsRes] = await Promise.all([
        supabase
          .from("publication_history")
          .select("*")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: true }),
        supabase
          .from("operation_logs")
          .select("*")
          .eq("entity_type", "mercado_livre")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: true }),
      ]);

      if (!pubRes.error && pubRes.data) setPub(pubRes.data as PublicationHistory[]);
      if (!logsRes.error && logsRes.data) setLogs(logsRes.data as OperationLog[]);
      setLoading(false);
    };

    load();
  }, [fromDays]);

  const filteredPub = filterType === "all" || filterType === "publication" ? pub : [];
  const filteredLogs = filterType === "all" || filterType === "integration" ? logs : [];

  const totalPub = filteredPub.length;
  const totalPubErrors = filteredPub.filter((p) => p.status === "error").length;
  const totalIntegrationErrors = filteredLogs.filter((l) => l.status === "error").length;

  const byDayPub = (() => {
    const map: Record<string, { success: number; error: number }> = {};
    filteredPub.forEach((row) => {
      const key = row.created_at.slice(0, 10);
      if (!map[key]) map[key] = { success: 0, error: 0 };
      map[key][row.status as "success" | "error"] += 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, value]) => ({ date, success: value.success, error: value.error }));
  })();

  const byErrorType = (() => {
    const map: Record<string, number> = {};
    filteredLogs
      .filter((l) => l.status === "error")
      .forEach((log) => {
        const key = log.operation_type || "desconhecido";
        map[key] = (map[key] || 0) + 1;
      });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({ type, count }));
  })();

  return (
    <Card className="p-4 space-y-4">
      <CardHeader className="pb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Painel de saúde da integração Mercado Livre
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Período (dias):</span>
            <Input
              type="number"
              min={1}
              max={90}
              className="h-7 w-16"
              value={fromDays}
              onChange={(e) => setFromDays(Number(e.target.value) || DEFAULT_DAYS)}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Mostrar:</span>
            <select
              className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="all">Tudo</option>
              <option value="publication">Apenas publicações</option>
              <option value="integration">Apenas erros de integração</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {loading ? (
          <p className="text-muted-foreground">Carregando métricas...</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Publicações</Badge>
                <span className="text-muted-foreground">Total: {totalPub}</span>
                <span className="text-destructive">Erros: {totalPubErrors}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Integração</Badge>
                <span className="text-muted-foreground">
                  Erros (logs de integração): {totalIntegrationErrors}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Sucesso x erro de publicação por dia */}
              <div className="h-44">
                <p className="text-xs text-muted-foreground mb-1">Publicações por dia (sucesso x erro)</p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={byDayPub} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="success"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      name="Sucesso"
                    />
                    <Line
                      type="monotone"
                      dataKey="error"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      name="Erro"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Tipos de erro de integração mais comuns */}
              <div className="h-44">
                <p className="text-xs text-muted-foreground mb-1">Tipos de erro de integração mais comuns</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byErrorType} margin={{ left: 8, right: 8, top: 8, bottom: 40 }}>
                    <CartesianGrid vertical={false} className="stroke-muted" />
                    <XAxis
                      dataKey="type"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      angle={-30}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
