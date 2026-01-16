import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { useSalesMetrics } from "@/hooks/useSalesMetrics";
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

  const { data, isLoading, error } = useSalesMetrics(options);

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

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Receita</p>
            <p className="text-2xl font-bold">{data ? formatCurrencyBRL(data.totalRevenue) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pedidos</p>
            <p className="text-2xl font-bold">{data ? data.totalOrders : "—"}</p>
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
            <p className="text-sm text-muted-foreground">Tempo médio até envio</p>
            <p className="text-2xl font-bold">{data?.avgShipHours == null ? "—" : `${data.avgShipHours}h`}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Faturamento por dia</CardTitle>
            <CardDescription>Soma do total_amount dos pedidos pagos</CardDescription>
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
                <LineChart data={data!.daily} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(v: any) => formatCurrencyBRL(Number(v))}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Pedidos por dia</CardTitle>
            <CardDescription>Contagem de pedidos sincronizados</CardDescription>
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

      <Card className="glass border-border/50 mt-4">
        <CardHeader>
          <CardTitle>Observações</CardTitle>
          <CardDescription>Dados reais e rastreáveis</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Conversão ainda usa o total de views atual do catálogo (não é por período). Se quiser conversão por período, precisamos registrar snapshots diários de views.
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
