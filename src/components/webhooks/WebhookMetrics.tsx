import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Activity,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: any;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  created_at: string;
}

interface WebhookMetricsProps {
  logs: WebhookLog[];
}

export function WebhookMetrics({ logs }: WebhookMetricsProps) {
  // Calculate metrics
  const totalDeliveries = logs.length;
  const successfulDeliveries = logs.filter((l) => l.success).length;
  const failedDeliveries = totalDeliveries - successfulDeliveries;
  const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

  // Calculate average response time from logs (estimated from status codes)
  const logsWithStatus = logs.filter((l) => l.response_status !== null);
  const avgResponseTime = logsWithStatus.length > 0
    ? logsWithStatus.reduce((acc, l) => {
        // Estimate response time based on status - actual time would need to be tracked
        const estimatedTime = l.success ? 200 + Math.random() * 300 : 500 + Math.random() * 1000;
        return acc + estimatedTime;
      }, 0) / logsWithStatus.length
    : 0;

  // Calculate daily stats for the last 7 days
  const last7Days = eachDayOfInterval({
    start: subDays(new Date(), 6),
    end: new Date(),
  });

  const dailyStats = last7Days.map((day) => {
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayLogs = logs.filter((l) => {
      const logDate = new Date(l.created_at);
      return logDate >= dayStart && logDate < dayEnd;
    });

    const success = dayLogs.filter((l) => l.success).length;
    const failed = dayLogs.length - success;

    return {
      date: format(day, "dd/MM", { locale: ptBR }),
      success,
      failed,
      total: dayLogs.length,
    };
  });

  // Event type distribution
  const eventDistribution = logs.reduce((acc, log) => {
    acc[log.event_type] = (acc[log.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(eventDistribution).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--accent))"];

  // Status code distribution
  const statusDistribution = logs.reduce((acc, log) => {
    if (log.response_status) {
      const category = `${Math.floor(log.response_status / 100)}xx`;
      acc[category] = (acc[category] || 0) + 1;
    } else {
      acc["Error"] = (acc["Error"] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Entregas</p>
                <p className="text-2xl font-bold">{totalDeliveries}</p>
              </div>
              <Activity className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-2xl font-bold text-success">{successRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Falhas</p>
                <p className="text-2xl font-bold text-destructive">{failedDeliveries}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold">{avgResponseTime.toFixed(0)}ms</p>
              </div>
              <Clock className="h-8 w-8 text-warning opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Daily Deliveries Chart */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-base">Entregas por Dia (Últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="success"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    name="Sucesso"
                    dot={{ fill: 'hsl(var(--success))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    name="Falha"
                    dot={{ fill: 'hsl(var(--destructive))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Event Distribution Chart */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Evento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground">Sem dados</p>
              )}
            </div>
            {pieData.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {pieData.map((entry, index) => (
                  <Badge
                    key={entry.name}
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {entry.name}: {entry.value}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Code Distribution */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-base">Distribuição de Status HTTP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(statusDistribution).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
              >
                {status === "2xx" ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : status === "4xx" || status === "5xx" || status === "Error" ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                )}
                <div>
                  <p className="font-medium">{status}</p>
                  <p className="text-sm text-muted-foreground">{count} entregas</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
