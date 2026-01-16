import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { useSalesMetrics } from "@/hooks/useSalesMetrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function SalesDashboard() {
  const { loading: authLoading } = useRequireAuth();
  const { data, isLoading, error } = useSalesMetrics(30);

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
    <DashboardLayout title="Dashboard de Vendas" subtitle="Receita, conversão e tempo de envio (dados reais)">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Receita (30d)</p>
            <p className="text-2xl font-bold">{data ? formatCurrencyBRL(data.totalRevenue) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pedidos (30d)</p>
            <p className="text-2xl font-bold">{data ? data.totalOrders : "—"}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Taxa de conversão</p>
            <p className="text-2xl font-bold">
              {data?.conversionRate == null ? "—" : `${(data.conversionRate * 100).toFixed(2)}%`}
            </p>
            <p className="text-xs text-muted-foreground">(Pedidos / Views do catálogo)</p>
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
            <CardTitle>Faturamento por dia (30d)</CardTitle>
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
            <CardTitle>Pedidos por dia (30d)</CardTitle>
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

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Status logístico (30d)</CardTitle>
            <CardDescription>Enviados vs entregues</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Enviados</p>
                  <p className="text-2xl font-bold">{data?.shippedOrders ?? "—"}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Entregues</p>
                  <p className="text-2xl font-bold">{data?.deliveredOrders ?? "—"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Observação</CardTitle>
            <CardDescription>Somente dados reais da integração</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Conversão usa os campos atuais do catálogo (views). Se você quiser conversão por período, precisamos registrar views por dia.
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
