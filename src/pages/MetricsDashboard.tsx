import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeTabs } from "@/hooks/useSwipeTabs";
import { SwipeIndicator } from "@/components/ui/SwipeIndicator";
import { toast } from "sonner";
import {
  Loader2,
  Download,
  TrendingUp,
  TrendingDown,
  Package,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  BarChart3,
  Image,
  Radio,
  Wifi,
  WifiOff,
} from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import html2canvas from "html2canvas";
import type { Tables } from "@/integrations/supabase/types";

type OperationLog = Tables<"operation_logs">;

interface TokenInfo {
  expires_at: string | null;
  updated_at: string | null;
  nickname: string | null;
}

const COLORS = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--chart-2))",
  error: "hsl(var(--destructive))",
  warning: "hsl(var(--chart-4))",
  info: "hsl(var(--chart-1))",
  muted: "hsl(var(--muted-foreground))",
};

const OPERATION_COLORS: Record<string, string> = {
  import: "hsl(var(--chart-1))",
  publish: "hsl(var(--chart-2))",
  update: "hsl(var(--chart-3))",
  delete: "hsl(var(--chart-4))",
  token_refresh: "hsl(var(--chart-5))",
  ai_optimization: "hsl(var(--primary))",
};

export default function MetricsDashboard() {
  const { user, loading: authLoading } = useRequireAuth();
  const { connection } = useMercadoLivre();
  const isMobile = useIsMobile();

  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("7d");
  const chartsRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [chartsTab, setChartsTab] = useState<"overview" | "operations" | "hourly" | "tokens">("overview");
  const [compactCharts, setCompactCharts] = useState<boolean>(() => isMobile);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      // Load operation logs
      const { data: logData } = await supabase
        .from("operation_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000);

      setLogs(logData || []);
      setLastUpdate(new Date());

      // Load token info
      const { data: tokenData } = await supabase
        .from("ml_tokens")
        .select("expires_at, updated_at, nickname")
        .eq("user_id", user.id)
        .maybeSingle();

      setTokenInfo(tokenData);
    } catch (err) {
      console.error("Error loading metrics:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Default compact mode on mobile (keeps user choice on desktop)
  useEffect(() => {
    if (isMobile) setCompactCharts(true);
  }, [isMobile]);

  // Realtime subscription for operation_logs
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('metrics-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'operation_logs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newLog = payload.new as OperationLog;
          setLogs((prevLogs) => [newLog, ...prevLogs].slice(0, 1000));
          setLastUpdate(new Date());
          
          // Show toast for new operations
          if (newLog.status === 'success') {
            toast.success(`Nova operação: ${newLog.operation_type}`, {
              description: 'Métricas atualizadas em tempo real',
              duration: 3000,
            });
          } else if (newLog.status === 'error') {
            toast.error(`Erro em ${newLog.operation_type}`, {
              description: newLog.error_message || 'Verifique os detalhes',
              duration: 5000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'operation_logs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedLog = payload.new as OperationLog;
          setLogs((prevLogs) =>
            prevLogs.map((log) => (log.id === updatedLog.id ? updatedLog : log))
          );
          setLastUpdate(new Date());
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ml_tokens',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          // Reload token info when tokens change
          const { data: tokenData } = await supabase
            .from("ml_tokens")
            .select("expires_at, updated_at, nickname")
            .eq("user_id", user.id)
            .maybeSingle();
          
          setTokenInfo(tokenData);
          setLastUpdate(new Date());
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Filter logs by period
  const filteredLogs = useMemo(() => {
    if (period === "all") return logs;
    const days = period === "7d" ? 7 : 30;
    const cutoff = subDays(new Date(), days);
    return logs.filter((log) => new Date(log.created_at) >= cutoff);
  }, [logs, period]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const success = filteredLogs.filter((l) => l.status === "success").length;
    const errors = filteredLogs.filter((l) => l.status === "error").length;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : "0";

    const byType: Record<string, { success: number; error: number }> = {};
    filteredLogs.forEach((log) => {
      const type = log.operation_type;
      if (!byType[type]) byType[type] = { success: 0, error: 0 };
      if (log.status === "success") byType[type].success++;
      else byType[type].error++;
    });

    const imports = (byType.import?.success || 0) + (byType.import?.error || 0);
    const publishes = (byType.publish?.success || 0) + (byType.publish?.error || 0);
    const updates = (byType.update?.success || 0) + (byType.update?.error || 0);
    const tokenRefreshes = (byType.token_refresh?.success || 0) + (byType.token_refresh?.error || 0);
    const aiOptimizations = (byType.ai_optimization?.success || 0) + (byType.ai_optimization?.error || 0);

    const avgDuration =
      filteredLogs.filter((l) => l.duration_ms).reduce((sum, l) => sum + (l.duration_ms || 0), 0) /
        filteredLogs.filter((l) => l.duration_ms).length || 0;

    return {
      total,
      success,
      errors,
      successRate,
      imports,
      publishes,
      updates,
      tokenRefreshes,
      aiOptimizations,
      avgDuration: Math.round(avgDuration),
      byType,
    };
  }, [filteredLogs]);

  // Period comparison (current vs previous)
  const periodComparison = useMemo(() => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 14;
    const today = new Date();
    
    // Current period
    const currentStart = subDays(today, days);
    const currentLogs = logs.filter((l) => {
      const date = new Date(l.created_at);
      return date >= currentStart && date <= today;
    });
    
    // Previous period
    const previousStart = subDays(currentStart, days);
    const previousLogs = logs.filter((l) => {
      const date = new Date(l.created_at);
      return date >= previousStart && date < currentStart;
    });
    
    const currentTotal = currentLogs.length;
    const previousTotal = previousLogs.length;
    const currentSuccess = currentLogs.filter((l) => l.status === "success").length;
    const previousSuccess = previousLogs.filter((l) => l.status === "success").length;
    const currentErrors = currentLogs.filter((l) => l.status === "error").length;
    const previousErrors = previousLogs.filter((l) => l.status === "error").length;
    
    const currentSuccessRate = currentTotal > 0 ? (currentSuccess / currentTotal) * 100 : 0;
    const previousSuccessRate = previousTotal > 0 ? (previousSuccess / previousTotal) * 100 : 0;
    
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    return {
      current: {
        total: currentTotal,
        success: currentSuccess,
        errors: currentErrors,
        successRate: currentSuccessRate.toFixed(1),
      },
      previous: {
        total: previousTotal,
        success: previousSuccess,
        errors: previousErrors,
        successRate: previousSuccessRate.toFixed(1),
      },
      changes: {
        total: calcChange(currentTotal, previousTotal),
        success: calcChange(currentSuccess, previousSuccess),
        errors: calcChange(currentErrors, previousErrors),
        successRate: currentSuccessRate - previousSuccessRate,
      },
      periodLabel: period === "7d" ? "7 dias" : period === "30d" ? "30 dias" : "14 dias",
    };
  }, [logs, period]);

  // Daily trend data
  const dailyTrend = useMemo(() => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 30;
    const today = startOfDay(new Date());
    const startDate = subDays(today, days - 1);

    const daysArray = eachDayOfInterval({ start: startDate, end: today });

    return daysArray.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayLogs = filteredLogs.filter(
        (l) => format(new Date(l.created_at), "yyyy-MM-dd") === dayStr
      );

      return {
        date: format(day, "dd/MM", { locale: ptBR }),
        success: dayLogs.filter((l) => l.status === "success").length,
        error: dayLogs.filter((l) => l.status !== "success").length,
        total: dayLogs.length,
      };
    });
  }, [filteredLogs, period]);

  // Operation type distribution
  const operationDistribution = useMemo(() => {
    return Object.entries(stats.byType).map(([type, counts]) => ({
      name: type,
      success: counts.success,
      error: counts.error,
      total: counts.success + counts.error,
    }));
  }, [stats.byType]);

  // Hourly distribution
  const hourlyDistribution = useMemo(() => {
    const hours: Record<string, { success: number; error: number }> = {};

    for (let i = 0; i < 24; i++) {
      hours[i.toString().padStart(2, "0")] = { success: 0, error: 0 };
    }

    filteredLogs.forEach((log) => {
      const hour = new Date(log.created_at).getHours().toString().padStart(2, "0");
      if (log.status === "success") hours[hour].success++;
      else hours[hour].error++;
    });

    return Object.entries(hours).map(([hour, counts]) => ({
      hour: `${hour}h`,
      success: counts.success,
      error: counts.error,
    }));
  }, [filteredLogs]);

  // Token status
  const tokenStatus = useMemo(() => {
    if (!tokenInfo?.expires_at) return { status: "disconnected", label: "Desconectado" };

    const expiresAt = new Date(tokenInfo.expires_at);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiry < 0) return { status: "expired", label: "Expirado" };
    if (hoursUntilExpiry < 1) return { status: "warning", label: "Expira em breve" };
    return { status: "valid", label: "Válido" };
  }, [tokenInfo]);

  // Export charts as PNG
  const exportAsImage = async () => {
    if (!chartsRef.current) return;

    setExporting(true);
    try {
      const canvas = await html2canvas(chartsRef.current, {
        backgroundColor: "#1a1a2e",
        scale: 2,
      });

      const link = document.createElement("a");
      link.download = `metricas-${format(new Date(), "yyyy-MM-dd-HHmm")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("Imagem exportada com sucesso!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar imagem");
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout
        title="Métricas Consolidadas"
        subtitle="Visão geral de todas as operações"
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Métricas Consolidadas"
      subtitle="Imports, publicações, tokens e performance em um só lugar"
    >
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Select value={period} onValueChange={(v) => setPeriod(v as "7d" | "30d" | "all")}>
              <SelectTrigger className="w-[140px] md:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="all">Todo período</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Realtime Status Indicator */}
            <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-full bg-muted/50 border text-xs">
              {realtimeConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Wifi className="h-3 w-3" />
                    <span className="hidden sm:inline">Tempo real</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <WifiOff className="h-3 w-3" />
                    <span className="hidden sm:inline">Conectando...</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-2 hidden sm:inline">Atualizar</span>
            </Button>
            
            <Button variant="outline" size="sm" onClick={exportAsImage} disabled={exporting} className="flex-1 sm:flex-none">
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Image className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </div>

        {/* Main content with ref for export */}
        <div ref={chartsRef} className="space-y-4 md:space-y-6">
          {/* Summary Stats */}
          <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <Card variant="glass">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Operações</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Activity className="h-8 w-8 text-primary opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Taxa de Sucesso</p>
                    <p className="text-2xl font-bold" style={{ color: COLORS.success }}>
                      {stats.successRate}%
                    </p>
                  </div>
                  {Number(stats.successRate) >= 80 ? (
                    <TrendingUp className="h-8 w-8 text-green-500 opacity-80" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-500 opacity-80" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Imports</p>
                    <p className="text-2xl font-bold">{stats.imports}</p>
                  </div>
                  <Upload className="h-8 w-8 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Publicações</p>
                    <p className="text-2xl font-bold">{stats.publishes}</p>
                  </div>
                  <Package className="h-8 w-8 text-purple-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Erros</p>
                    <p className="text-2xl font-bold" style={{ color: COLORS.error }}>
                      {stats.errors}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Token ML</p>
                    <Badge
                      variant={
                        tokenStatus.status === "valid"
                          ? "success"
                          : tokenStatus.status === "warning"
                          ? "warning"
                          : "destructive"
                      }
                      className="mt-1"
                    >
                      {tokenStatus.label}
                    </Badge>
                  </div>
                  <RefreshCw className="h-8 w-8 text-orange-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Period Comparison */}
          <Card variant="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Comparativo de Períodos
              </CardTitle>
              <CardDescription className="text-xs">
                {periodComparison.periodLabel} atuais vs {periodComparison.periodLabel} anteriores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground mb-1">Total Operações</p>
                  <p className="text-2xl font-bold">{periodComparison.current.total}</p>
                  <p className="text-xs text-muted-foreground">
                    vs {periodComparison.previous.total} anterior
                  </p>
                  <div className={`flex items-center justify-center gap-1 mt-1 text-xs ${
                    periodComparison.changes.total >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {periodComparison.changes.total >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(periodComparison.changes.total).toFixed(1)}%
                  </div>
                </div>

                <div className="text-center p-4 rounded-lg bg-green-500/10">
                  <p className="text-xs text-muted-foreground mb-1">Sucessos</p>
                  <p className="text-2xl font-bold text-green-500">{periodComparison.current.success}</p>
                  <p className="text-xs text-muted-foreground">
                    vs {periodComparison.previous.success} anterior
                  </p>
                  <div className={`flex items-center justify-center gap-1 mt-1 text-xs ${
                    periodComparison.changes.success >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {periodComparison.changes.success >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(periodComparison.changes.success).toFixed(1)}%
                  </div>
                </div>

                <div className="text-center p-4 rounded-lg bg-red-500/10">
                  <p className="text-xs text-muted-foreground mb-1">Erros</p>
                  <p className="text-2xl font-bold text-red-500">{periodComparison.current.errors}</p>
                  <p className="text-xs text-muted-foreground">
                    vs {periodComparison.previous.errors} anterior
                  </p>
                  <div className={`flex items-center justify-center gap-1 mt-1 text-xs ${
                    periodComparison.changes.errors <= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {periodComparison.changes.errors <= 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <TrendingUp className="h-3 w-3" />
                    )}
                    {Math.abs(periodComparison.changes.errors).toFixed(1)}%
                  </div>
                </div>

                <div className="text-center p-4 rounded-lg bg-primary/10">
                  <p className="text-xs text-muted-foreground mb-1">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold">{periodComparison.current.successRate}%</p>
                  <p className="text-xs text-muted-foreground">
                    vs {periodComparison.previous.successRate}% anterior
                  </p>
                  <div className={`flex items-center justify-center gap-1 mt-1 text-xs ${
                    periodComparison.changes.successRate >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {periodComparison.changes.successRate >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(periodComparison.changes.successRate).toFixed(1)}pp
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts Section */}
          {(() => {
            const swipeHandlers = useSwipeTabs({
              tabs: ["overview", "operations", "hourly", "tokens"] as const,
              value: chartsTab,
              onValueChange: (v) => setChartsTab(v),
              enabled: isMobile,
            });

            const hSmall = compactCharts ? 200 : 250;
            const hMedium = compactCharts ? 240 : 300;

            return (
              <Tabs value={chartsTab} onValueChange={(v) => setChartsTab(v as typeof chartsTab)} className="space-y-4" {...swipeHandlers}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <TabsList className="w-full md:w-auto flex flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="overview" className="flex-1 md:flex-none text-xs md:text-sm">Visão Geral</TabsTrigger>
                    <TabsTrigger value="operations" className="flex-1 md:flex-none text-xs md:text-sm">Por Operação</TabsTrigger>
                    <TabsTrigger value="hourly" className="flex-1 md:flex-none text-xs md:text-sm">Por Hora</TabsTrigger>
                    <TabsTrigger value="tokens" className="flex-1 md:flex-none text-xs md:text-sm">Tokens</TabsTrigger>
                  </TabsList>

                  <div className="flex items-center justify-between md:justify-end gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="compact-charts" className="text-xs text-muted-foreground">Compacto</Label>
                      <Switch
                        id="compact-charts"
                        checked={compactCharts}
                        onCheckedChange={(v) => setCompactCharts(Boolean(v))}
                      />
                    </div>
                  </div>
                </div>

                {isMobile && (
                  <SwipeIndicator
                    currentIndex={["overview", "operations", "hourly", "tokens"].indexOf(chartsTab)}
                    totalTabs={4}
                    tabLabels={["Visão", "Oper.", "Hora", "Tokens"]}
                  />
                )}

                <TabsContent value="overview" className="space-y-4" animated>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* Daily Trend */}
                    <Card variant="glass">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          Tendência Diária
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Sucesso vs Erros por dia
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div style={{ height: hSmall }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyTrend}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: compactCharts ? 9 : 10, fill: "hsl(var(--muted-foreground))" }}
                              />
                              <YAxis
                                tick={{ fontSize: compactCharts ? 9 : 10, fill: "hsl(var(--muted-foreground))" }}
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
                              <Legend wrapperStyle={{ fontSize: compactCharts ? "10px" : "11px" }} />
                              <Area
                                type="monotone"
                                dataKey="success"
                                name="Sucesso"
                                stackId="1"
                                stroke={COLORS.success}
                                fill={COLORS.success}
                                fillOpacity={0.6}
                              />
                              <Area
                                type="monotone"
                                dataKey="error"
                                name="Erro"
                                stackId="1"
                                stroke={COLORS.error}
                                fill={COLORS.error}
                                fillOpacity={0.6}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Success/Error Pie */}
                    <Card variant="glass">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          Distribuição de Status
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Proporção sucesso vs erro
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div style={{ height: hSmall }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: "Sucesso", value: stats.success, color: COLORS.success },
                                  { name: "Erro", value: stats.errors, color: COLORS.error },
                                ]}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={compactCharts ? 45 : 50}
                                outerRadius={compactCharts ? 70 : 80}
                                paddingAngle={2}
                              >
                                <Cell fill={COLORS.success} />
                                <Cell fill={COLORS.error} />
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                }}
                              />
                              <Legend
                                wrapperStyle={{ fontSize: compactCharts ? "10px" : "11px" }}
                                formatter={(value) => (
                                  <span className="text-foreground">{value}</span>
                                )}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="operations" className="space-y-4" animated>
                  <Card variant="glass">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        Operações por Tipo
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Distribuição de imports, publicações, atualizações, etc.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div style={{ height: hMedium }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={operationDistribution} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              type="number"
                              tick={{ fontSize: compactCharts ? 9 : 10, fill: "hsl(var(--muted-foreground))" }}
                              allowDecimals={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              tick={{ fontSize: compactCharts ? 9 : 10, fill: "hsl(var(--muted-foreground))" }}
                              width={compactCharts ? 70 : 100}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: compactCharts ? "10px" : "11px" }} />
                            <Bar
                              dataKey="success"
                              name="Sucesso"
                              fill={COLORS.success}
                              stackId="a"
                              radius={[0, 4, 4, 0]}
                            />
                            <Bar
                              dataKey="error"
                              name="Erro"
                              fill={COLORS.error}
                              stackId="a"
                              radius={[0, 4, 4, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="hourly" className="space-y-4" animated>
                  <Card variant="glass">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Atividade por Hora do Dia
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Quando ocorrem mais operações
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div style={{ height: hMedium }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={hourlyDistribution}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="hour"
                              tick={{ fontSize: compactCharts ? 8 : 9, fill: "hsl(var(--muted-foreground))" }}
                            />
                            <YAxis
                              tick={{ fontSize: compactCharts ? 9 : 10, fill: "hsl(var(--muted-foreground))" }}
                              allowDecimals={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: compactCharts ? "10px" : "11px" }} />
                            <Bar
                              dataKey="success"
                              name="Sucesso"
                              fill={COLORS.success}
                              stackId="a"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="error"
                              name="Erro"
                              fill={COLORS.error}
                              stackId="a"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tokens" className="space-y-4" animated>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card variant="glass">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-primary" />
                          Status do Token
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge
                              variant={
                                tokenStatus.status === "valid"
                                  ? "success"
                                  : tokenStatus.status === "warning"
                                  ? "warning"
                                  : "destructive"
                              }
                            >
                              {tokenStatus.label}
                            </Badge>
                          </div>

                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Conexão ML:</span>
                            <span className="font-medium">
                              {connection.connected
                                ? connection.nickname || "Conectado"
                                : "Desconectado"}
                            </span>
                          </div>

                          {tokenInfo?.expires_at && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Expira em:</span>
                              <span className="font-medium">
                                {format(new Date(tokenInfo.expires_at), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                          )}

                          {tokenInfo?.updated_at && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Última renovação:</span>
                              <span className="font-medium">
                                {format(new Date(tokenInfo.updated_at), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card variant="glass">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary" />
                          Renovações de Token
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="text-center">
                            <p className="text-4xl font-bold">{stats.tokenRefreshes}</p>
                            <p className="text-xs text-muted-foreground">
                              renovações no período
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-2 rounded-lg bg-green-500/10">
                              <p className="text-lg font-bold text-green-500">
                                {stats.byType.token_refresh?.success || 0}
                              </p>
                              <p className="text-xs text-muted-foreground">Sucesso</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-red-500/10">
                              <p className="text-lg font-bold text-red-500">
                                {stats.byType.token_refresh?.error || 0}
                              </p>
                              <p className="text-xs text-muted-foreground">Falhas</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            );
          })()}
          {/* Performance Stats */}
          <Card variant="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4 rounded-lg bg-muted/40">
                  <p className="text-2xl font-bold">{stats.avgDuration}ms</p>
                  <p className="text-xs text-muted-foreground">Tempo médio por operação</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/40">
                  <p className="text-2xl font-bold">{stats.aiOptimizations}</p>
                  <p className="text-xs text-muted-foreground">Otimizações IA</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/40">
                  <p className="text-2xl font-bold">{stats.updates}</p>
                  <p className="text-xs text-muted-foreground">Atualizações</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/40">
                  <p className="text-2xl font-bold">
                    {Math.round(stats.total / (period === "7d" ? 7 : period === "30d" ? 30 : 30))}
                  </p>
                  <p className="text-xs text-muted-foreground">Média por dia</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
