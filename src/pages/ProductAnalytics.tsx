import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRequireAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { AIComparisonCharts } from "@/components/analytics/AIComparisonCharts";
import { GoalsManager } from "@/components/analytics/GoalsManager";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Package,
  Eye,
  ShoppingCart,
  DollarSign,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Sparkles,
  Target,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { exportAnalyticsPDF } from "@/utils/exportAnalyticsPDF";
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
  ComposedChart,
} from "recharts";
import { format, subDays, eachDayOfInterval, parseISO, startOfDay, endOfDay, subMonths, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;
type PublicationHistory = Tables<"publication_history">;

const COLORS = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--chart-2))",
  error: "hsl(var(--destructive))",
  warning: "hsl(var(--chart-4))",
  info: "hsl(var(--chart-1))",
  chart3: "hsl(var(--chart-3))",
  chart5: "hsl(var(--chart-5))",
};

const STATUS_COLORS: Record<string, string> = {
  published: "hsl(var(--chart-2))",
  draft: "hsl(var(--chart-4))",
  pending: "hsl(var(--chart-1))",
  error: "hsl(var(--destructive))",
  paused: "hsl(var(--muted-foreground))",
};

export default function ProductAnalytics() {
  const { user, loading: authLoading } = useRequireAuth();
  const { products, loading: productsLoading } = useProducts();
  const [publicationHistory, setPublicationHistory] = useState<PublicationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");

  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("publication_history")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setPublicationHistory(data || []);
      } catch (err) {
        console.error("Error loading publication history:", err);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, [user]);

  // Filter data by period
  const { filteredProducts, filteredHistory } = useMemo(() => {
    if (period === "all") {
      return { filteredProducts: products, filteredHistory: publicationHistory };
    }

    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const cutoff = subDays(new Date(), days);

    return {
      filteredProducts: products.filter((p) => new Date(p.created_at) >= cutoff),
      filteredHistory: publicationHistory.filter((h) => new Date(h.created_at) >= cutoff),
    };
  }, [products, publicationHistory, period]);

  // Stats calculations
  const stats = useMemo(() => {
    const total = products.length;
    const published = products.filter((p) => p.status === "published").length;
    const draft = products.filter((p) => p.status === "draft").length;
    const pending = products.filter((p) => p.status === "pending").length;
    const errors = products.filter((p) => p.status === "error").length;
    const paused = products.filter((p) => p.status === "paused").length;

    const totalViews = products.reduce((acc, p) => acc + (p.views || 0), 0);
    const totalSales = products.reduce((acc, p) => acc + (p.sales || 0), 0);
    const totalRevenue = products.reduce((acc, p) => acc + ((p.sales || 0) * (p.price || 0)), 0);
    const aiOptimized = products.filter((p) => p.ai_optimized).length;
    const conversionRate = totalViews > 0 ? ((totalSales / totalViews) * 100).toFixed(2) : "0";

    return {
      total,
      published,
      draft,
      pending,
      errors,
      paused,
      totalViews,
      totalSales,
      totalRevenue,
      aiOptimized,
      conversionRate,
    };
  }, [products]);

  // Publications over time
  const publicationsOverTime = useMemo(() => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 90;
    const today = startOfDay(new Date());
    const startDate = subDays(today, days - 1);

    const daysArray = eachDayOfInterval({ start: startDate, end: today });

    return daysArray.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      
      const productsPublished = filteredProducts.filter((p) => {
        if (!p.published_at) return false;
        return format(new Date(p.published_at), "yyyy-MM-dd") === dayStr;
      }).length;

      const productsCreated = filteredProducts.filter((p) => 
        format(new Date(p.created_at), "yyyy-MM-dd") === dayStr
      ).length;

      const historyEvents = filteredHistory.filter((h) =>
        format(new Date(h.created_at), "yyyy-MM-dd") === dayStr
      );

      const success = historyEvents.filter((h) => h.status === "success").length;
      const failed = historyEvents.filter((h) => h.status !== "success").length;

      return {
        date: format(day, "dd/MM", { locale: ptBR }),
        fullDate: dayStr,
        publicados: productsPublished,
        criados: productsCreated,
        sucesso: success,
        falhas: failed,
      };
    });
  }, [filteredProducts, filteredHistory, period]);

  // Status distribution for pie chart
  const statusDistribution = useMemo(() => {
    return [
      { name: "Publicados", value: stats.published, color: STATUS_COLORS.published },
      { name: "Rascunho", value: stats.draft, color: STATUS_COLORS.draft },
      { name: "Pendente", value: stats.pending, color: STATUS_COLORS.pending },
      { name: "Erro", value: stats.errors, color: STATUS_COLORS.error },
      { name: "Pausado", value: stats.paused, color: STATUS_COLORS.paused },
    ].filter((item) => item.value > 0);
  }, [stats]);

  // Category distribution
  const categoryDistribution = useMemo(() => {
    const categories: Record<string, number> = {};
    products.forEach((p) => {
      const cat = p.category_name || "Sem categoria";
      categories[cat] = (categories[cat] || 0) + 1;
    });

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [products]);

  // Top products by views/sales
  const topProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5)
      .map((p) => ({
        title: p.title.length > 30 ? p.title.substring(0, 30) + "..." : p.title,
        views: p.views || 0,
        sales: p.sales || 0,
        revenue: (p.sales || 0) * (p.price || 0),
      }));
  }, [products]);

  // Performance by listing type
  const listingTypePerformance = useMemo(() => {
    const types: Record<string, { count: number; views: number; sales: number }> = {};
    
    products.forEach((p) => {
      const type = p.listing_type || "standard";
      if (!types[type]) {
        types[type] = { count: 0, views: 0, sales: 0 };
      }
      types[type].count++;
      types[type].views += p.views || 0;
      types[type].sales += p.sales || 0;
    });

    return Object.entries(types).map(([name, data]) => ({
      name: name === "gold_special" ? "Clássico" : name === "gold_pro" ? "Premium" : name,
      quantidade: data.count,
      visualizações: data.views,
      vendas: data.sales,
    }));
  }, [products]);

  // Price range distribution
  const priceRangeDistribution = useMemo(() => {
    const ranges = [
      { label: "R$ 0-50", min: 0, max: 50, count: 0 },
      { label: "R$ 50-100", min: 50, max: 100, count: 0 },
      { label: "R$ 100-250", min: 100, max: 250, count: 0 },
      { label: "R$ 250-500", min: 250, max: 500, count: 0 },
      { label: "R$ 500-1000", min: 500, max: 1000, count: 0 },
      { label: "R$ 1000+", min: 1000, max: Infinity, count: 0 },
    ];

    products.forEach((p) => {
      const price = p.price || 0;
      const range = ranges.find((r) => price >= r.min && price < r.max);
      if (range) range.count++;
    });

    return ranges.map((r) => ({ name: r.label, quantidade: r.count }));
  }, [products]);

  // AI comparison stats for PDF export
  const aiStats = useMemo(() => {
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

  const handleExportPDF = () => {
    try {
      const fileName = exportAnalyticsPDF({
        period,
        stats,
        aiStats,
        topProducts,
        categoryDistribution,
        priceRangeDistribution,
        trendData: publicationsOverTime,
      });
      toast.success(`Relatório exportado: ${fileName}`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar relatório PDF");
    }
  };

  const loading = authLoading || productsLoading || historyLoading;

  if (loading) {
    return (
      <DashboardLayout
        title="Analytics de Produtos"
        subtitle="Performance e métricas de seus produtos"
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Analytics de Produtos"
      subtitle="Acompanhe a performance de seus produtos ao longo do tempo"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Tabs defaultValue="overview" className="w-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <TabsList className="flex-wrap">
                <TabsTrigger value="overview" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Visão Geral
                </TabsTrigger>
                <TabsTrigger value="ai-comparison" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  IA vs Manual
                </TabsTrigger>
                <TabsTrigger value="goals" className="gap-2">
                  <Target className="h-4 w-4" />
                  Metas
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 90 dias</SelectItem>
                    <SelectItem value="all">Todo o período</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="gap-2" onClick={handleExportPDF}>
                  <FileDown className="h-4 w-4" />
                  Exportar PDF
                </Button>
              </div>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Card variant="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Produtos</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Package className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Publicados</p>
                  <p className="text-2xl font-bold text-green-500">{stats.published}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Visualizações</p>
                  <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
                </div>
                <Eye className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                  <p className="text-2xl font-bold">{stats.totalSales}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                  <p className="text-2xl font-bold">
                    R$ {stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-emerald-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Conversão</p>
                  <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                </div>
                <Activity className="h-8 w-8 text-orange-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Publications Over Time */}
          <Card variant="glass" className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Produtos ao Longo do Tempo
              </CardTitle>
              <CardDescription className="text-xs">
                Criados vs Publicados por dia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={publicationsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
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
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Area
                      type="monotone"
                      dataKey="criados"
                      name="Criados"
                      fill={COLORS.info}
                      stroke={COLORS.info}
                      fillOpacity={0.3}
                    />
                    <Bar
                      dataKey="publicados"
                      name="Publicados"
                      fill={COLORS.success}
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="sucesso"
                      name="Sucesso"
                      stroke={COLORS.chart3}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card variant="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Distribuição por Status
              </CardTitle>
              <CardDescription className="text-xs">
                Proporção de produtos por status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {statusDistribution.map((entry, index) => (
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

          {/* Category Distribution */}
          <Card variant="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Produtos por Categoria
              </CardTitle>
              <CardDescription className="text-xs">
                Top 8 categorias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" name="Produtos" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card variant="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Top 5 Produtos
              </CardTitle>
              <CardDescription className="text-xs">
                Por visualizações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="title"
                      tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                      angle={-15}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="views" name="Views" fill={COLORS.info} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sales" name="Vendas" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Price Range Distribution */}
          <Card variant="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Distribuição por Preço
              </CardTitle>
              <CardDescription className="text-xs">
                Quantidade de produtos por faixa de preço
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priceRangeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="quantidade" name="Produtos" fill={COLORS.chart5} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Optimization Stats */}
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Estatísticas de Otimização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-primary/10">
                <p className="text-xs text-muted-foreground mb-1">Otimizados por IA</p>
                <p className="text-2xl font-bold">{stats.aiOptimized}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.total > 0 ? ((stats.aiOptimized / stats.total) * 100).toFixed(0) : 0}% do total
                </p>
              </div>

              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <p className="text-xs text-muted-foreground mb-1">Taxa de Publicação</p>
                <p className="text-2xl font-bold text-green-500">
                  {stats.total > 0 ? ((stats.published / stats.total) * 100).toFixed(0) : 0}%
                </p>
              </div>

              <div className="text-center p-4 rounded-lg bg-blue-500/10">
                <p className="text-xs text-muted-foreground mb-1">Média Views/Produto</p>
                <p className="text-2xl font-bold text-blue-500">
                  {stats.published > 0 ? Math.round(stats.totalViews / stats.published) : 0}
                </p>
              </div>

              <div className="text-center p-4 rounded-lg bg-purple-500/10">
                <p className="text-xs text-muted-foreground mb-1">Ticket Médio</p>
                <p className="text-2xl font-bold text-purple-500">
                  R$ {stats.totalSales > 0 
                    ? (stats.totalRevenue / stats.totalSales).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) 
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
            </TabsContent>

            {/* AI Comparison Tab */}
            <TabsContent value="ai-comparison">
              <AIComparisonCharts products={products} />
            </TabsContent>

            {/* Goals Tab */}
            <TabsContent value="goals">
              {user && <GoalsManager userId={user.id} products={products} />}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
