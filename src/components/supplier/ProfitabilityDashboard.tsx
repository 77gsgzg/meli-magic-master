import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Percent
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie
} from "recharts";

interface ProductProfitability {
  id: string;
  title: string;
  supplierPrice: number;
  expectedMargin: number;
  targetPrice: number;
  realRevenue: number;
  realCost: number;
  realMargin: number;
  unitsSold: number;
  marginDiff: number;
  status: "above" | "below" | "on_target";
}

interface ProfitabilitySummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageMargin: number;
  expectedAverageMargin: number;
  marginDiff: number;
  productsAboveTarget: number;
  productsBelowTarget: number;
  productsOnTarget: number;
}

export function ProfitabilityDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const { data, isLoading } = useQuery({
    queryKey: ["profitability", user?.id, period],
    enabled: !!user?.id,
    queryFn: async () => {
      const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
      const days = daysMap[period];
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      // Fetch supplier products
      const { data: supplierProducts, error: spError } = await supabase
        .from("supplier_products")
        .select("id, title, price, margin, target_price, ml_item_id, published_product_id")
        .eq("user_id", user!.id)
        .eq("is_published", true);

      if (spError) throw spError;

      // Fetch orders for the period
      const { data: orders, error: ordersError } = await supabase
        .from("ml_orders")
        .select("ml_item_id, total_amount, item_quantity, unit_price")
        .eq("user_id", user!.id)
        .eq("status", "paid")
        .gte("date_created", fromDate.toISOString());

      if (ordersError) throw ordersError;

      // Calculate profitability per product
      const productProfitability: ProductProfitability[] = [];
      let totalRevenue = 0;
      let totalCost = 0;
      let productsAboveTarget = 0;
      let productsBelowTarget = 0;
      let productsOnTarget = 0;

      for (const sp of supplierProducts || []) {
        if (!sp.ml_item_id) continue;

        // Find orders for this product
        const productOrders = (orders || []).filter(o => o.ml_item_id === sp.ml_item_id);
        
        if (productOrders.length === 0) continue;

        const unitsSold = productOrders.reduce((sum, o) => sum + (o.item_quantity || 1), 0);
        const revenue = productOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        const supplierPrice = Number(sp.price) || 0;
        const cost = supplierPrice * unitsSold;
        const profit = revenue - cost;
        const realMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
        const expectedMargin = Number(sp.margin) || 30;
        const marginDiff = realMargin - expectedMargin;

        let status: "above" | "below" | "on_target" = "on_target";
        if (marginDiff > 5) {
          status = "above";
          productsAboveTarget++;
        } else if (marginDiff < -5) {
          status = "below";
          productsBelowTarget++;
        } else {
          productsOnTarget++;
        }

        totalRevenue += revenue;
        totalCost += cost;

        productProfitability.push({
          id: sp.id,
          title: sp.title,
          supplierPrice,
          expectedMargin,
          targetPrice: Number(sp.target_price) || supplierPrice * (1 + expectedMargin / 100),
          realRevenue: revenue,
          realCost: cost,
          realMargin: Math.round(realMargin * 100) / 100,
          unitsSold,
          marginDiff: Math.round(marginDiff * 100) / 100,
          status,
        });
      }

      const totalProfit = totalRevenue - totalCost;
      const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      const expectedAverageMargin = productProfitability.length > 0
        ? productProfitability.reduce((sum, p) => sum + p.expectedMargin, 0) / productProfitability.length
        : 30;

      const summary: ProfitabilitySummary = {
        totalRevenue,
        totalCost,
        totalProfit,
        averageMargin: Math.round(averageMargin * 100) / 100,
        expectedAverageMargin: Math.round(expectedAverageMargin * 100) / 100,
        marginDiff: Math.round((averageMargin - expectedAverageMargin) * 100) / 100,
        productsAboveTarget,
        productsBelowTarget,
        productsOnTarget,
      };

      return {
        products: productProfitability.sort((a, b) => b.realRevenue - a.realRevenue),
        summary,
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const chartData = useMemo(() => {
    if (!data?.products) return [];
    return data.products.slice(0, 10).map(p => ({
      name: p.title.substring(0, 20) + (p.title.length > 20 ? "..." : ""),
      "Margem Real": p.realMargin,
      "Margem Esperada": p.expectedMargin,
    }));
  }, [data?.products]);

  const pieData = useMemo(() => {
    if (!data?.summary) return [];
    return [
      { name: "Acima da Meta", value: data.summary.productsAboveTarget, color: "#22c55e" },
      { name: "Na Meta", value: data.summary.productsOnTarget, color: "#3b82f6" },
      { name: "Abaixo da Meta", value: data.summary.productsBelowTarget, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [data?.summary]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const products = data?.products || [];

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Rentabilidade</h2>
          <p className="text-muted-foreground">
            Compare a margem real vs esperada por produto
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Custo: {formatCurrency(summary?.totalCost || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.totalProfit || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {products.length} produtos vendidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Margem Real</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.averageMargin || 0}%</div>
            <div className="flex items-center gap-1 text-xs">
              {summary && summary.marginDiff >= 0 ? (
                <span className="text-green-600 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{summary.marginDiff}% vs esperado
                </span>
              ) : (
                <span className="text-red-600 flex items-center">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {summary?.marginDiff}% vs esperado
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Margem Esperada</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.expectedAverageMargin || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Meta média configurada
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar Chart - Margin Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Comparativo de Margem por Produto
            </CardTitle>
            <CardDescription>Top 10 produtos por receita</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={100}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                  />
                  <Legend />
                  <Bar dataKey="Margem Real" fill="#22c55e" />
                  <Bar dataKey="Margem Esperada" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado disponível para o período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Products by Target Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Distribuição por Meta
            </CardTitle>
            <CardDescription>Produtos vs meta de margem</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado disponível para o período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Produto</CardTitle>
          <CardDescription>
            Análise detalhada de rentabilidade de cada produto
          </CardDescription>
        </CardHeader>
        <CardContent>
          {products.length > 0 ? (
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.title}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>Vendidos: {product.unitsSold}</span>
                      <span>Receita: {formatCurrency(product.realRevenue)}</span>
                      <span>Custo: {formatCurrency(product.realCost)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Real:</span>
                        <span className="font-semibold">{product.realMargin}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Meta:</span>
                        <span>{product.expectedMargin}%</span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        product.status === "above" 
                          ? "default" 
                          : product.status === "below" 
                          ? "destructive" 
                          : "secondary"
                      }
                      className="flex items-center gap-1 min-w-[80px] justify-center"
                    >
                      {product.status === "above" && <TrendingUp className="h-3 w-3" />}
                      {product.status === "below" && <TrendingDown className="h-3 w-3" />}
                      {product.status === "on_target" && <CheckCircle2 className="h-3 w-3" />}
                      {product.marginDiff > 0 ? "+" : ""}{product.marginDiff}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">Sem dados de vendas</h3>
              <p className="text-muted-foreground">
                Nenhum produto do fornecedor foi vendido no período selecionado
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
