import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { useSalesMetrics, DailyRevenuePoint } from "@/hooks/useSalesMetrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
  Legend,
} from "recharts";

function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type Preset = "7" | "30" | "90" | "custom";

export default function SalesDashboard() {
  const { loading: authLoading } = useRequireAuth();

  const [preset, setPreset] = useState<Preset>("30");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const options = useMemo(() => {
    if (preset === "custom") {
      return {
        from: from ? new Date(`${from}T00:00:00`) : undefined,
        to: to ? new Date(`${to}T23:59:59`) : undefined,
        days: 30,
      };
    }
    return Number(preset);
  }, [preset, from, to]);

  // Previous period for comparison
  const prevOptions = useMemo(() => {
    const days = typeof options === "number" ? options : 30;
    return days * 2; // double the days to get previous period
  }, [options]);

  const { data, isLoading, error } = useSalesMetrics(options);
  const { data: prevData } = useSalesMetrics(prevOptions);

  // Funnel data
  const funnelData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Pagos", value: data.totalOrders, fill: "hsl(var(--primary))" },
      { name: "Enviados", value: data.shippedOrders, fill: "hsl(var(--accent))" },
      { name: "Entregues", value: data.deliveredOrders, fill: "hsl(142 76% 36%)" },
    ];
  }, [data]);

  // Period comparison
  const comparison = useMemo(() => {
    if (!data || !prevData) return null;
    const days = typeof options === "number" ? options : 30;
    // prevData has double the period, so we need to estimate the "previous period" portion
    // This is a simplification - ideally we'd fetch exact date ranges
    const prevRevenue = prevData.totalRevenue - data.totalRevenue;
    const prevOrders = prevData.totalOrders - data.totalOrders;

    const revenueDelta = prevRevenue > 0 ? ((data.totalRevenue - prevRevenue) / prevRevenue) * 100 : null;
    const ordersDelta = prevOrders > 0 ? ((data.totalOrders - prevOrders) / prevOrders) * 100 : null;

    return { revenueDelta, ordersDelta, prevRevenue, prevOrders };
  }, [data, prevData, options]);

  // Comparison chart data (current vs previous period side by side)
  const comparisonChartData = useMemo(() => {
    if (!data?.daily || !prevData?.daily) return [];
    
    const days = typeof options === "number" ? options : 30;
    const currentDays = data.daily;
    const allPrevDays = prevData.daily;
    
    // Get the previous period days (exclude current period from prevData)
    const prevDays = allPrevDays.slice(0, Math.max(0, allPrevDays.length - currentDays.length));
    
    // Create aligned data for comparison
    const result: { day: number; current: number; previous: number; currentDate?: string; prevDate?: string }[] = [];
    
    const maxLen = Math.max(currentDays.length, prevDays.length);
    for (let i = 0; i < maxLen; i++) {
      const currentPoint = currentDays[i];
      const prevPoint = prevDays[i];
      result.push({
        day: i + 1,
        current: currentPoint?.revenue || 0,
        previous: prevPoint?.revenue || 0,
        currentDate: currentPoint?.date,
        prevDate: prevPoint?.date,
      });
    }
    
    return result;
  }, [data?.daily, prevData?.daily, options]);

  if (authLoading) {
    return (
      <DashboardLayout title="Vendas" subtitle="Carregando...">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard de Vendas" subtitle="Métricas reais: pedidos, faturamento e logística">
      <Card className="glass border-border/50 mb-4">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecione o período para os gráficos e rankings.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="w-full md:w-[220px]">
            <p className="text-sm text-muted-foreground mb-1">Período</p>
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {preset === "custom" && (
            <>
              <div className="w-full md:w-[220px]">
                <p className="text-sm text-muted-foreground mb-1">De</p>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="w-full md:w-[220px]">
                <p className="text-sm text-muted-foreground mb-1">Até</p>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-6 mb-6">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Receita</p>
            <p className="text-2xl font-bold">{data ? formatCurrencyBRL(data.totalRevenue) : "—"}</p>
            {comparison?.revenueDelta != null && (
              <p className={`text-xs mt-1 ${comparison.revenueDelta >= 0 ? "text-green-600" : "text-red-500"}`}>
                {comparison.revenueDelta >= 0 ? "+" : ""}{comparison.revenueDelta.toFixed(1)}% vs anterior
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pedidos (pagos)</p>
            <p className="text-2xl font-bold">{data ? data.totalOrders : "—"}</p>
            {comparison?.ordersDelta != null && (
              <p className={`text-xs mt-1 ${comparison.ordersDelta >= 0 ? "text-green-600" : "text-red-500"}`}>
                {comparison.ordersDelta >= 0 ? "+" : ""}{comparison.ordersDelta.toFixed(1)}% vs anterior
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ticket médio</p>
            <p className="text-2xl font-bold">{data?.avgOrderValue == null ? "—" : formatCurrencyBRL(data.avgOrderValue)}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Taxa de envio</p>
            <p className="text-2xl font-bold">{data?.shipRate == null ? "—" : `${data.shipRate}%`}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Taxa de entrega</p>
            <p className="text-2xl font-bold">{data?.deliveryRate == null ? "—" : `${data.deliveryRate}%`}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tempo médio até envio</p>
            <p className="text-2xl font-bold">{data?.avgShipHours == null ? "—" : `${data.avgShipHours}h`}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card className="glass border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle>Faturamento: Atual vs Anterior</CardTitle>
            <CardDescription>Comparação lado a lado do período selecionado</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : error ? (
              <div className="text-sm text-destructive">Erro ao carregar métricas</div>
            ) : comparisonChartData.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados para comparação.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" label={{ value: "Dia", position: "bottom", fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(v: any, name: string) => [formatCurrencyBRL(Number(v)), name === "current" ? "Período atual" : "Período anterior"]}
                    labelFormatter={(day) => `Dia ${day}`}
                  />
                  <Legend 
                    formatter={(value) => value === "current" ? "Período atual" : "Período anterior"}
                  />
                  <Line type="monotone" dataKey="current" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="current" />
                  <Line type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} name="previous" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Funil de conversão</CardTitle>
            <CardDescription>Pago → Enviado → Entregue</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : funnelData.length === 0 || data?.totalOrders === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList position="center" fill="#fff" stroke="none" dataKey="name" fontSize={12} />
                    <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="value" fontSize={12} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Curva de coortes (semanal)</CardTitle>
            <CardDescription>Pago → Enviado → Entregue (percentuais por semana)</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.weeklyCohorts?.length || 0) === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data!.weeklyCohorts} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(v: any) => `${Number(v).toFixed(1)}%`}
                  />
                  <Line type="monotone" dataKey="shippedRate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Enviados %" />
                  <Line type="monotone" dataKey="deliveredRate" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} name="Entregues %" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Pedidos por dia</CardTitle>
            <CardDescription>Contagem de pedidos pagos no período</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : error ? (
              <div className="text-sm text-destructive">Erro ao carregar métricas</div>
            ) : (data?.daily?.length || 0) === 0 ? (
              <div className="text-sm text-muted-foreground">Sem vendas no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data!.daily} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Top produtos (por receita)</CardTitle>
            <CardDescription>Pedidos pagos no período</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.topProducts?.length || 0) === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <div className="space-y-2">
                {data!.topProducts.map((p) => (
                  <div key={p.key} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-background/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.orders} pedido(s)</p>
                    </div>
                    <div className="text-sm font-semibold">{formatCurrencyBRL(p.revenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Top compradores (por receita)</CardTitle>
            <CardDescription>Somente nickname retornado pela API</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.topBuyers?.length || 0) === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <div className="space-y-2">
                {data!.topBuyers.map((b) => (
                  <div key={b.key} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-background/40">
                    <div>
                      <p className="text-sm font-medium">{b.label}</p>
                      <p className="text-xs text-muted-foreground">{b.orders} pedido(s)</p>
                    </div>
                    <div className="text-sm font-semibold">{formatCurrencyBRL(b.revenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
