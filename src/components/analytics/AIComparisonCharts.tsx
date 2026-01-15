import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Eye,
  ShoppingCart,
  DollarSign,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface AIComparisonChartsProps {
  products: Product[];
}

const COLORS = {
  ai: "hsl(var(--primary))",
  manual: "hsl(var(--chart-4))",
  success: "hsl(var(--chart-2))",
};

export function AIComparisonCharts({ products }: AIComparisonChartsProps) {
  const stats = useMemo(() => {
    const aiProducts = products.filter((p) => p.ai_optimized);
    const manualProducts = products.filter((p) => !p.ai_optimized);

    const calculateStats = (items: Product[]) => {
      const count = items.length;
      const published = items.filter((p) => p.status === "published").length;
      const totalViews = items.reduce((acc, p) => acc + (p.views || 0), 0);
      const totalSales = items.reduce((acc, p) => acc + (p.sales || 0), 0);
      const totalRevenue = items.reduce(
        (acc, p) => acc + (p.sales || 0) * (p.price || 0),
        0
      );

      return {
        count,
        published,
        publishRate: count > 0 ? (published / count) * 100 : 0,
        totalViews,
        avgViews: published > 0 ? totalViews / published : 0,
        totalSales,
        avgSales: published > 0 ? totalSales / published : 0,
        totalRevenue,
        avgRevenue: published > 0 ? totalRevenue / published : 0,
        conversionRate: totalViews > 0 ? (totalSales / totalViews) * 100 : 0,
      };
    };

    const ai = calculateStats(aiProducts);
    const manual = calculateStats(manualProducts);

    // Calculate improvement percentages
    const calcImprovement = (aiVal: number, manualVal: number) => {
      if (manualVal === 0) return aiVal > 0 ? 100 : 0;
      return ((aiVal - manualVal) / manualVal) * 100;
    };

    return {
      ai,
      manual,
      improvements: {
        publishRate: calcImprovement(ai.publishRate, manual.publishRate),
        avgViews: calcImprovement(ai.avgViews, manual.avgViews),
        avgSales: calcImprovement(ai.avgSales, manual.avgSales),
        avgRevenue: calcImprovement(ai.avgRevenue, manual.avgRevenue),
        conversionRate: calcImprovement(ai.conversionRate, manual.conversionRate),
      },
    };
  }, [products]);

  const comparisonData = useMemo(() => [
    {
      metric: "Taxa Publicação",
      "Com IA": Number(stats.ai.publishRate.toFixed(1)),
      "Sem IA": Number(stats.manual.publishRate.toFixed(1)),
    },
    {
      metric: "Média Views",
      "Com IA": Number(stats.ai.avgViews.toFixed(0)),
      "Sem IA": Number(stats.manual.avgViews.toFixed(0)),
    },
    {
      metric: "Média Vendas",
      "Com IA": Number(stats.ai.avgSales.toFixed(1)),
      "Sem IA": Number(stats.manual.avgSales.toFixed(1)),
    },
    {
      metric: "Conversão (%)",
      "Com IA": Number(stats.ai.conversionRate.toFixed(2)),
      "Sem IA": Number(stats.manual.conversionRate.toFixed(2)),
    },
  ], [stats]);

  const radarData = useMemo(() => {
    // Normalize values for radar chart (0-100 scale)
    const maxViews = Math.max(stats.ai.avgViews, stats.manual.avgViews) || 1;
    const maxSales = Math.max(stats.ai.avgSales, stats.manual.avgSales) || 1;
    const maxRevenue = Math.max(stats.ai.avgRevenue, stats.manual.avgRevenue) || 1;

    return [
      {
        subject: "Publicação",
        ai: stats.ai.publishRate,
        manual: stats.manual.publishRate,
      },
      {
        subject: "Views",
        ai: (stats.ai.avgViews / maxViews) * 100,
        manual: (stats.manual.avgViews / maxViews) * 100,
      },
      {
        subject: "Vendas",
        ai: (stats.ai.avgSales / maxSales) * 100,
        manual: (stats.manual.avgSales / maxSales) * 100,
      },
      {
        subject: "Receita",
        ai: (stats.ai.avgRevenue / maxRevenue) * 100,
        manual: (stats.manual.avgRevenue / maxRevenue) * 100,
      },
      {
        subject: "Conversão",
        ai: Math.min(stats.ai.conversionRate * 10, 100),
        manual: Math.min(stats.manual.conversionRate * 10, 100),
      },
    ];
  }, [stats]);

  const distributionData = [
    { name: "Com IA", value: stats.ai.count, color: COLORS.ai },
    { name: "Sem IA", value: stats.manual.count, color: COLORS.manual },
  ];

  const ImprovementBadge = ({ value }: { value: number }) => (
    <Badge
      variant={value >= 0 ? "success" : "destructive"}
      className="gap-1 text-xs"
    >
      {value >= 0 ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {value >= 0 ? "+" : ""}
      {value.toFixed(1)}%
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Produtos IA</span>
              </div>
              <Badge variant="outline">{stats.ai.count}</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.ai.publishRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Taxa de publicação</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-500" />
                <span className="text-sm text-muted-foreground">Média Views</span>
              </div>
              <ImprovementBadge value={stats.improvements.avgViews} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-lg font-bold text-primary">
                  {stats.ai.avgViews.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">Com IA</p>
              </div>
              <div>
                <p className="text-lg font-bold text-muted-foreground">
                  {stats.manual.avgViews.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">Sem IA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-purple-500" />
                <span className="text-sm text-muted-foreground">Média Vendas</span>
              </div>
              <ImprovementBadge value={stats.improvements.avgSales} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-lg font-bold text-primary">
                  {stats.ai.avgSales.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">Com IA</p>
              </div>
              <div>
                <p className="text-lg font-bold text-muted-foreground">
                  {stats.manual.avgSales.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">Sem IA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Conversão</span>
              </div>
              <ImprovementBadge value={stats.improvements.conversionRate} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-lg font-bold text-primary">
                  {stats.ai.conversionRate.toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground">Com IA</p>
              </div>
              <div>
                <p className="text-lg font-bold text-muted-foreground">
                  {stats.manual.conversionRate.toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground">Sem IA</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar Chart Comparison */}
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Comparativo de Métricas
            </CardTitle>
            <CardDescription className="text-xs">
              Performance com vs sem otimização por IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="metric"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar
                    dataKey="Com IA"
                    fill={COLORS.ai}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Sem IA"
                    fill={COLORS.manual}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Radar Chart */}
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Análise Multidimensional
            </CardTitle>
            <CardDescription className="text-xs">
              Comparativo normalizado de performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Radar
                    name="Com IA"
                    dataKey="ai"
                    stroke={COLORS.ai}
                    fill={COLORS.ai}
                    fillOpacity={0.5}
                  />
                  <Radar
                    name="Sem IA"
                    dataKey="manual"
                    stroke={COLORS.manual}
                    fill={COLORS.manual}
                    fillOpacity={0.3}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribution Pie */}
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Distribuição de Produtos
            </CardTitle>
            <CardDescription className="text-xs">
              Proporção otimizados vs não otimizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px" }}
                    formatter={(value) => (
                      <span className="text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Comparison */}
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Receita Total Comparada
            </CardTitle>
            <CardDescription className="text-xs">
              Faturamento por tipo de produto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Produtos com IA
                  </span>
                  <span className="text-xl font-bold">
                    R$ {stats.ai.totalRevenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.ai.totalSales} vendas • {stats.ai.published} produtos publicados
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Produtos sem IA</span>
                  <span className="text-xl font-bold text-muted-foreground">
                    R$ {stats.manual.totalRevenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.manual.totalSales} vendas • {stats.manual.published} produtos publicados
                </p>
              </div>

              {stats.improvements.avgRevenue > 0 && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      Produtos otimizados por IA geram em média{" "}
                      <strong>{stats.improvements.avgRevenue.toFixed(0)}% mais receita</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
