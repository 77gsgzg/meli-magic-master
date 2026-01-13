import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { TrendingUp, PieChart as PieChartIcon, BarChart3 } from "lucide-react";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PublicationLog {
  id: string;
  created_at: string;
  action: string;
  status: string;
  error_details: string | null;
  product_id: string;
}

interface PublicationStatsChartsProps {
  logs: PublicationLog[];
}

const COLORS = {
  success: "hsl(var(--chart-2))",
  error: "hsl(var(--destructive))",
  publish: "hsl(var(--chart-1))",
  update: "hsl(var(--chart-3))",
  delete: "hsl(var(--chart-4))",
  other: "hsl(var(--chart-5))",
};

export function PublicationStatsCharts({ logs }: PublicationStatsChartsProps) {
  // Calculate stats
  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter((l) => l.status === "success").length;
    const error = logs.filter((l) => l.status !== "success").length;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : "0";

    return { total, success, error, successRate };
  }, [logs]);

  // Data for daily trend (last 7 days)
  const dailyTrend = useMemo(() => {
    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 6);
    
    const days = eachDayOfInterval({ start: sevenDaysAgo, end: today });
    
    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayLogs = logs.filter((l) => {
        const logDate = format(new Date(l.created_at), "yyyy-MM-dd");
        return logDate === dayStr;
      });

      return {
        date: format(day, "dd/MM", { locale: ptBR }),
        success: dayLogs.filter((l) => l.status === "success").length,
        error: dayLogs.filter((l) => l.status !== "success").length,
      };
    });
  }, [logs]);

  // Data for pie chart (success vs error)
  const pieData = useMemo(() => {
    return [
      { name: "Sucesso", value: stats.success, color: COLORS.success },
      { name: "Erro", value: stats.error, color: COLORS.error },
    ].filter((d) => d.value > 0);
  }, [stats]);

  // Data for actions distribution
  const actionData = useMemo(() => {
    const actionCounts: Record<string, { success: number; error: number }> = {};
    
    logs.forEach((log) => {
      if (!actionCounts[log.action]) {
        actionCounts[log.action] = { success: 0, error: 0 };
      }
      if (log.status === "success") {
        actionCounts[log.action].success++;
      } else {
        actionCounts[log.action].error++;
      }
    });

    return Object.entries(actionCounts).map(([action, counts]) => ({
      action,
      success: counts.success,
      error: counts.error,
      total: counts.success + counts.error,
    }));
  }, [logs]);

  if (logs.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Summary Stats */}
      <Card variant="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Resumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: COLORS.success }}>{stats.successRate}%</div>
              <div className="text-xs text-muted-foreground">Taxa de Sucesso</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: COLORS.success }}>{stats.success}</div>
              <div className="text-xs text-muted-foreground">Sucesso</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: COLORS.error }}>{stats.error}</div>
              <div className="text-xs text-muted-foreground">Erros</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pie Chart */}
      <Card variant="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-primary" />
            Distribuição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }} 
                />
                <Legend 
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value) => <span className="text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Daily Trend */}
      <Card variant="glass" className="md:col-span-2 lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Tendência (7 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="success" 
                  name="Sucesso"
                  stroke={COLORS.success} 
                  strokeWidth={2}
                  dot={{ fill: COLORS.success, strokeWidth: 0, r: 3 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="error" 
                  name="Erro"
                  stroke={COLORS.error} 
                  strokeWidth={2}
                  dot={{ fill: COLORS.error, strokeWidth: 0, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Actions Distribution */}
      {actionData.length > 0 && (
        <Card variant="glass" className="md:col-span-2 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Por Tipo de Ação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={actionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    allowDecimals={false}
                  />
                  <YAxis 
                    type="category"
                    dataKey="action"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    width={80}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }} 
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: "11px" }}
                    formatter={(value) => <span className="text-foreground">{value}</span>}
                  />
                  <Bar dataKey="success" name="Sucesso" fill={COLORS.success} stackId="a" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="error" name="Erro" fill={COLORS.error} stackId="a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
