import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Calendar,
  Package,
  BarChart3,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignHistory {
  id: string;
  campaign_type: string;
  status: string;
  recipients_count: number;
  converted_count: number;
  details: Record<string, any> | null;
  created_at: string;
}

interface CampaignConsolidatedDashboardProps {
  campaigns: CampaignHistory[];
  averageOrderValue: number;
  campaignCost: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export function CampaignConsolidatedDashboard({
  campaigns,
  averageOrderValue,
  campaignCost,
}: CampaignConsolidatedDashboardProps) {
  // Calculate all metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const last30Days = campaigns.filter(c => 
      new Date(c.created_at) >= subDays(now, 30)
    );
    const previous30Days = campaigns.filter(c => {
      const date = new Date(c.created_at);
      return date >= subDays(now, 60) && date < subDays(now, 30);
    });

    // Current month
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const currentMonthCampaigns = campaigns.filter(c =>
      isWithinInterval(new Date(c.created_at), { start: currentMonthStart, end: currentMonthEnd })
    );

    // Totals
    const totalCampaigns = campaigns.length;
    const totalRecipients = campaigns.reduce((sum, c) => sum + c.recipients_count, 0);
    const totalConverted = campaigns.reduce((sum, c) => sum + c.converted_count, 0);
    const conversionRate = totalRecipients > 0 ? (totalConverted / totalRecipients) * 100 : 0;
    const totalRevenue = totalConverted * averageOrderValue;
    const totalCost = totalRecipients * campaignCost;
    const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
    const netProfit = totalRevenue - totalCost;

    // Last 30 days comparison
    const last30Recipients = last30Days.reduce((sum, c) => sum + c.recipients_count, 0);
    const last30Converted = last30Days.reduce((sum, c) => sum + c.converted_count, 0);
    const prev30Recipients = previous30Days.reduce((sum, c) => sum + c.recipients_count, 0);
    const prev30Converted = previous30Days.reduce((sum, c) => sum + c.converted_count, 0);

    const recipientsChange = prev30Recipients > 0 
      ? ((last30Recipients - prev30Recipients) / prev30Recipients) * 100 
      : 0;
    const convertedChange = prev30Converted > 0 
      ? ((last30Converted - prev30Converted) / prev30Converted) * 100 
      : 0;

    // By type
    const reactivationCampaigns = campaigns.filter(c => c.campaign_type === "reactivation");
    const stockAlertCampaigns = campaigns.filter(c => c.campaign_type === "stock_alert");

    // Daily data for charts
    const dailyData: Record<string, any> = {};
    campaigns.forEach(c => {
      const day = format(new Date(c.created_at), "dd/MM");
      if (!dailyData[day]) {
        dailyData[day] = { day, campaigns: 0, recipients: 0, converted: 0, revenue: 0 };
      }
      dailyData[day].campaigns++;
      dailyData[day].recipients += c.recipients_count;
      dailyData[day].converted += c.converted_count;
      dailyData[day].revenue += c.converted_count * averageOrderValue;
    });

    const chartData = Object.values(dailyData).slice(-14);

    // Pie chart data
    const typeDistribution = [
      { name: "Reativação", value: reactivationCampaigns.length },
      { name: "Alerta Estoque", value: stockAlertCampaigns.length },
    ];

    return {
      totalCampaigns,
      totalRecipients,
      totalConverted,
      conversionRate,
      totalRevenue,
      totalCost,
      roi,
      netProfit,
      last30Recipients,
      last30Converted,
      recipientsChange,
      convertedChange,
      reactivationCampaigns: reactivationCampaigns.length,
      stockAlertCampaigns: stockAlertCampaigns.length,
      currentMonthCampaigns: currentMonthCampaigns.length,
      chartData,
      typeDistribution,
    };
  }, [campaigns, averageOrderValue, campaignCost]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards - Row 1 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receita Total</p>
                <p className="text-2xl font-bold text-green-500">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Lucro líquido: {formatCurrency(metrics.netProfit)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ROI Geral</p>
                <p className={`text-2xl font-bold ${metrics.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {metrics.roi.toFixed(1)}%
                </p>
              </div>
              <div className={`p-3 rounded-full ${metrics.roi >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                <Percent className={`h-6 w-6 ${metrics.roi >= 0 ? "text-green-500" : "text-red-500"}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Custo total: {formatCurrency(metrics.totalCost)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                <p className="text-2xl font-bold text-primary">
                  {metrics.conversionRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {metrics.convertedChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={`text-xs ${metrics.convertedChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                {Math.abs(metrics.convertedChange).toFixed(1)}% vs últimos 30 dias
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Campanhas</p>
                <p className="text-2xl font-bold">{metrics.totalCampaigns}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Activity className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Este mês: {metrics.currentMonthCampaigns}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <p className="text-sm text-muted-foreground">Total Destinatários</p>
            </div>
            <p className="text-2xl font-bold">{metrics.totalRecipients.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-2">
              {metrics.recipientsChange >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={`text-xs ${metrics.recipientsChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                {Math.abs(metrics.recipientsChange).toFixed(1)}% vs período anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-green-500" />
              <p className="text-sm text-muted-foreground">Total Convertidos</p>
            </div>
            <p className="text-2xl font-bold">{metrics.totalConverted.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Ticket médio: {formatCurrency(averageOrderValue)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Reativações</p>
            </div>
            <p className="text-2xl font-bold">{metrics.reactivationCampaigns}</p>
            <Badge variant="outline" className="mt-2">
              {((metrics.reactivationCampaigns / Math.max(metrics.totalCampaigns, 1)) * 100).toFixed(0)}% do total
            </Badge>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-orange-500" />
              <p className="text-sm text-muted-foreground">Alertas de Estoque</p>
            </div>
            <p className="text-2xl font-bold">{metrics.stockAlertCampaigns}</p>
            <Badge variant="outline" className="mt-2">
              {((metrics.stockAlertCampaigns / Math.max(metrics.totalCampaigns, 1)) * 100).toFixed(0)}% do total
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="glass border-border/50 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Evolução de Receita
            </CardTitle>
            <CardDescription>Receita gerada nos últimos 14 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.chartData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Receita"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fill="url(#revenueGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Distribuição por Tipo
            </CardTitle>
            <CardDescription>Campanhas por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.typeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {metrics.typeDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [value, "Campanhas"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversions Chart */}
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Destinatários vs Conversões
          </CardTitle>
          <CardDescription>Comparativo de envios e conversões nos últimos 14 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                  }}
                />
                <Legend />
                <Bar dataKey="recipients" name="Destinatários" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="converted" name="Convertidos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
