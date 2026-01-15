import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  CheckCircle2, 
  XCircle,
  Clock,
  Calendar,
  Loader2,
  Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useAuth";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface ImportLog {
  id: string;
  batch_id: string;
  total_urls: number;
  success_count: number;
  failed_count: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  is_paused: boolean;
  can_resume: boolean;
}

interface DailyStats {
  date: string;
  success: number;
  failed: number;
  total: number;
  successRate: number;
}

const COLORS = {
  success: 'hsl(var(--chart-2))',
  failed: 'hsl(var(--destructive))',
  pending: 'hsl(var(--muted-foreground))',
};

export function BatchImportStats() {
  const { session } = useRequireAuth();
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState("30");

  useEffect(() => {
    if (session?.user?.id) {
      fetchLogs();
    }
  }, [session?.user?.id, periodDays]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const startDate = subDays(new Date(), parseInt(periodDays));
      
      const { data, error } = await supabase
        .from('batch_import_logs')
        .select('*')
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: false });

      if (error) throw error;
      setLogs((data as ImportLog[]) || []);
    } catch (err) {
      console.error("Error fetching import logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const totalImports = logs.length;
    const totalUrls = logs.reduce((acc, log) => acc + log.total_urls, 0);
    const totalSuccess = logs.reduce((acc, log) => acc + log.success_count, 0);
    const totalFailed = logs.reduce((acc, log) => acc + log.failed_count, 0);
    const successRate = totalUrls > 0 ? Math.round((totalSuccess / totalUrls) * 100) : 0;
    const avgPerImport = totalImports > 0 ? Math.round(totalUrls / totalImports) : 0;

    return {
      totalImports,
      totalUrls,
      totalSuccess,
      totalFailed,
      successRate,
      avgPerImport,
    };
  }, [logs]);

  // Calculate daily stats for chart
  const dailyStats = useMemo(() => {
    const days = parseInt(periodDays);
    const statsMap = new Map<string, DailyStats>();

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      statsMap.set(date, {
        date,
        success: 0,
        failed: 0,
        total: 0,
        successRate: 0,
      });
    }

    // Aggregate logs by day
    logs.forEach(log => {
      const date = format(new Date(log.started_at), 'yyyy-MM-dd');
      const existing = statsMap.get(date);
      if (existing) {
        existing.success += log.success_count;
        existing.failed += log.failed_count;
        existing.total += log.total_urls;
        existing.successRate = existing.total > 0 
          ? Math.round((existing.success / existing.total) * 100) 
          : 0;
      }
    });

    return Array.from(statsMap.values())
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, periodDays]);

  // Pie chart data
  const pieData = useMemo(() => [
    { name: 'Sucesso', value: overallStats.totalSuccess, color: COLORS.success },
    { name: 'Falha', value: overallStats.totalFailed, color: COLORS.failed },
  ], [overallStats]);

  // Calculate trend (compare last 7 days vs previous 7 days)
  const trend = useMemo(() => {
    const now = new Date();
    const last7Days = logs.filter(log => {
      const logDate = new Date(log.started_at);
      return logDate >= subDays(now, 7);
    });
    const previous7Days = logs.filter(log => {
      const logDate = new Date(log.started_at);
      return logDate >= subDays(now, 14) && logDate < subDays(now, 7);
    });

    const lastSuccess = last7Days.reduce((acc, log) => acc + log.success_count, 0);
    const lastTotal = last7Days.reduce((acc, log) => acc + log.total_urls, 0);
    const prevSuccess = previous7Days.reduce((acc, log) => acc + log.success_count, 0);
    const prevTotal = previous7Days.reduce((acc, log) => acc + log.total_urls, 0);

    const lastRate = lastTotal > 0 ? (lastSuccess / lastTotal) * 100 : 0;
    const prevRate = prevTotal > 0 ? (prevSuccess / prevTotal) * 100 : 0;

    return {
      direction: lastRate >= prevRate ? 'up' : 'down',
      change: Math.abs(Math.round(lastRate - prevRate)),
    };
  }, [logs]);

  if (loading) {
    return (
      <Card variant="glass">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with period filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Estatísticas de Importação</h2>
            <p className="text-sm text-muted-foreground">
              Análise detalhada das importações em lote
            </p>
          </div>
        </div>
        <Select value={periodDays} onValueChange={setPeriodDays}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Importações</p>
                <p className="text-2xl font-bold">{overallStats.totalImports}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">URLs Processadas</p>
                <p className="text-2xl font-bold">{overallStats.totalUrls}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{overallStats.successRate}%</p>
                  {trend.direction === 'up' ? (
                    <Badge variant="success" className="gap-1">
                      <TrendingUp className="h-3 w-3" />
                      +{trend.change}%
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <TrendingDown className="h-3 w-3" />
                      -{trend.change}%
                    </Badge>
                  )}
                </div>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média por Lote</p>
                <p className="text-2xl font-bold">{overallStats.avgPerImport}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Line Chart - Success Rate Trend */}
        <Card variant="glass" className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Taxa de Sucesso ao Longo do Tempo</CardTitle>
            <CardDescription>Evolução da taxa de sucesso das importações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
                    formatter={(value: number) => [`${value}%`, 'Taxa de Sucesso']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="successRate" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Success vs Failed */}
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição de Resultados</CardTitle>
            <CardDescription>Sucesso vs Falha</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart - Daily Volume */}
      <Card variant="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Volume Diário de Importações</CardTitle>
          <CardDescription>Quantidade de URLs processadas por dia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
                />
                <Bar dataKey="success" stackId="a" fill={COLORS.success} name="Sucesso" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" stackId="a" fill={COLORS.failed} name="Falha" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Imports Table */}
      <Card variant="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Importações Recentes</CardTitle>
          <CardDescription>Histórico detalhado das últimas importações</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {logs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    {log.status === 'complete' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : log.status === 'error' ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : log.is_paused ? (
                      <Clock className="h-5 w-5 text-warning" />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(log.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.total_urls} URLs • Lote: {log.batch_id.substring(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success">{log.success_count}✓</Badge>
                    <Badge variant="destructive">{log.failed_count}✗</Badge>
                    {log.is_paused && log.can_resume && (
                      <Badge variant="warning">Pausado</Badge>
                    )}
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma importação no período</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
