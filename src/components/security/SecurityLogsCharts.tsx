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

 type OperationLog = Tables<'operation_logs'>;

interface SecurityLogsChartsProps {
  logs: OperationLog[];
}

function groupErrorsByDay(logs: OperationLog[]) {
  const map: Record<string, number> = {};
  logs
    .filter((l) => l.status === "error")
    .forEach((log) => {
      const d = new Date(log.created_at);
      const key = d.toISOString().slice(0, 10);
      map[key] = (map[key] || 0) + 1;
    });
  return Object.entries(map)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));
}

function groupErrorsByOperation(logs: OperationLog[]) {
  const map: Record<string, number> = {};
  logs
    .filter((l) => l.status === "error")
    .forEach((log) => {
      const key = log.operation_type || "desconhecido";
      map[key] = (map[key] || 0) + 1;
    });
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .map(([operation, count]) => ({ operation, count }));
}

function groupErrorsByHour(logs: OperationLog[]) {
  const map: Record<string, number> = {};
  logs
    .filter((l) => l.status === "error")
    .forEach((log) => {
      const d = new Date(log.created_at);
      const hour = d.getHours().toString().padStart(2, "0");
      map[hour] = (map[hour] || 0) + 1;
    });
  return Object.entries(map)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([hour, count]) => ({ hour, count }));
}

export function SecurityLogsCharts({ logs }: SecurityLogsChartsProps) {
  const byDay = groupErrorsByDay(logs);
  const byOperation = groupErrorsByOperation(logs);
  const byHour = groupErrorsByHour(logs);

  if (logs.length === 0) return null;

  return (
    <Card className="p-4 space-y-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Tendências de erros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Erros por dia */}
        <div className="h-40">
          <p className="text-xs text-muted-foreground mb-1">Volume de erros por dia</p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byDay} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tipos de operação mais problemáticos */}
        <div className="h-40">
          <p className="text-xs text-muted-foreground mb-1">Tipos de operação com mais erros</p>
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
              <Bar dataKey="count" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Horários de pico de falhas */}
        <div className="h-40">
          <p className="text-xs text-muted-foreground mb-1">Horário do dia com mais falhas</p>
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
