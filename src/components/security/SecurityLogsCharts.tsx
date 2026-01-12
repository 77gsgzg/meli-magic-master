import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";

 type OperationLog = Tables<'operation_logs'>;

interface SecurityLogsChartsProps {
  logs: OperationLog[];
  mode: "errors" | "all";
  period: "7d" | "30d" | "custom";
}

function filterByPeriod(logs: OperationLog[], period: "7d" | "30d" | "custom") {
  if (period === "custom") return logs;
  const now = new Date();
  const days = period === "7d" ? 7 : 30;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return logs.filter((log) => new Date(log.created_at) >= cutoff);
}

function groupByDay(logs: OperationLog[], onlyErrors: boolean) {
  const map: Record<string, { errors: number; total: number }> = {};
  logs.forEach((log) => {
    const d = new Date(log.created_at);
    const key = d.toISOString().slice(0, 10);
    if (!map[key]) map[key] = { errors: 0, total: 0 };
    map[key].total += 1;
    if (log.status === "error") map[key].errors += 1;
  });
  return Object.entries(map)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, count: onlyErrors ? value.errors : value.total }));
}

function groupByOperation(logs: OperationLog[], onlyErrors: boolean) {
  const map: Record<string, { errors: number; total: number }> = {};
  logs.forEach((log) => {
    const key = log.operation_type || "desconhecido";
    if (!map[key]) map[key] = { errors: 0, total: 0 };
    map[key].total += 1;
    if (log.status === "error") map[key].errors += 1;
  });
  return Object.entries(map)
    .sort(([, a], [, b]) => (onlyErrors ? b.errors - a.errors : b.total - a.total))
    .map(([operation, value]) => ({
      operation,
      count: onlyErrors ? value.errors : value.total,
    }));
}

function groupByHour(logs: OperationLog[], onlyErrors: boolean) {
  const map: Record<string, { errors: number; total: number }> = {};
  logs.forEach((log) => {
    const d = new Date(log.created_at);
    const hour = d.getHours().toString().padStart(2, "0");
    if (!map[hour]) map[hour] = { errors: 0, total: 0 };
    map[hour].total += 1;
    if (log.status === "error") map[hour].errors += 1;
  });
  return Object.entries(map)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([hour, value]) => ({ hour, count: onlyErrors ? value.errors : value.total }));
}

export function SecurityLogsCharts({ logs, mode, period }: SecurityLogsChartsProps) {
  const onlyErrors = mode === "errors";
  const filtered = filterByPeriod(logs, period);
  const byDay = groupByDay(filtered, onlyErrors);
  const byOperation = groupByOperation(filtered, onlyErrors);
  const byHour = groupByHour(filtered, onlyErrors);

  if (logs.length === 0) return null;

  return (
    <Card className="p-4 space-y-4">
      <CardHeader className="pb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-sm font-medium">Tendências de {onlyErrors ? "erros" : "todas as operações"}</CardTitle>
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Modo:</span>
            <Button
              type="button"
              size="sm"
              variant={onlyErrors ? "default" : "outline"}
              className="h-7 px-2 text-xs"
            >
              Somente erros
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!onlyErrors ? "default" : "outline"}
              className="h-7 px-2 text-xs"
            >
              Todas as operações
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Período (aplicado nos filtros principais):</span>
            <span className="font-medium">
              {period === "7d" ? "Últimos 7 dias" : period === "30d" ? "Últimos 30 dias" : "Personalizado"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Por dia */}
        <div className="h-40">
          <p className="text-xs text-muted-foreground mb-1">
            Volume de {onlyErrors ? "erros" : "operações"} por dia
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byDay} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="count"
                stroke={onlyErrors ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tipos de operação */}
        <div className="h-40">
          <p className="text-xs text-muted-foreground mb-1">
            Tipos de operação com mais {onlyErrors ? "erros" : "ocorrências"}
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byOperation} margin={{ left: 8, right: 8, top: 8, bottom: 40 }}>
              <CartesianGrid vertical={false} className="stroke-muted" />
              <XAxis
                dataKey="operation"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                angle={-30}
                textAnchor="end"
                height={40}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="count"
                fill={onlyErrors ? "hsl(var(--destructive))" : "hsl(var(--warning))"}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Horário do dia */}
        <div className="h-40">
          <p className="text-xs text-muted-foreground mb-1">
            Horário do dia com mais {onlyErrors ? "falhas" : "operações"}
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byHour} margin={{ left: 8, right: 8, top: 8, bottom: 20 }}>
              <CartesianGrid vertical={false} className="stroke-muted" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
