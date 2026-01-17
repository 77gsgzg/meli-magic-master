import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, Target, ArrowUpRight, Percent, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignHistory {
  id: string;
  user_id: string;
  campaign_type: string;
  status: string;
  recipients_count: number;
  converted_count: number;
  details: Record<string, any> | null;
  created_at: string;
}

interface CampaignROIReportProps {
  campaigns: CampaignHistory[];
  averageOrderValue?: number;
  campaignCost?: number;
}

export function CampaignROIReport({ 
  campaigns, 
  averageOrderValue = 150, 
  campaignCost = 5 
}: CampaignROIReportProps) {
  const roiMetrics = useMemo(() => {
    const reactivationCampaigns = campaigns.filter(c => c.campaign_type === "reactivation");
    const stockAlertCampaigns = campaigns.filter(c => c.campaign_type === "stock_alert");

    // Reactivation metrics
    const totalReactivationRecipients = reactivationCampaigns.reduce((sum, c) => sum + c.recipients_count, 0);
    const totalReactivationConverted = reactivationCampaigns.reduce((sum, c) => sum + c.converted_count, 0);
    const reactivationConversionRate = totalReactivationRecipients > 0 
      ? (totalReactivationConverted / totalReactivationRecipients) * 100 
      : 0;
    
    // Estimated revenue from reactivations
    const estimatedReactivationRevenue = totalReactivationConverted * averageOrderValue;
    const reactivationCampaignCost = totalReactivationRecipients * campaignCost;
    const reactivationROI = reactivationCampaignCost > 0 
      ? ((estimatedReactivationRevenue - reactivationCampaignCost) / reactivationCampaignCost) * 100 
      : 0;

    // Stock alert metrics (for awareness/prevention)
    const totalStockAlerts = stockAlertCampaigns.length;
    const stockAlertRecipients = stockAlertCampaigns.reduce((sum, c) => sum + c.recipients_count, 0);
    
    // Calculate estimated prevented stockouts (assuming 20% of alerts prevent a stockout worth avg order value * 10)
    const estimatedPreventedStockoutValue = totalStockAlerts * 0.2 * averageOrderValue * 10;

    // Monthly breakdown
    const monthlyData = campaigns.reduce((acc, campaign) => {
      const month = format(new Date(campaign.created_at), "MMM/yy", { locale: ptBR });
      if (!acc[month]) {
        acc[month] = {
          month,
          reactivations: 0,
          stockAlerts: 0,
          converted: 0,
          recipients: 0,
          revenue: 0,
        };
      }
      if (campaign.campaign_type === "reactivation") {
        acc[month].reactivations++;
        acc[month].converted += campaign.converted_count;
        acc[month].revenue += campaign.converted_count * averageOrderValue;
      } else {
        acc[month].stockAlerts++;
      }
      acc[month].recipients += campaign.recipients_count;
      return acc;
    }, {} as Record<string, any>);

    const monthlyBreakdown = Object.values(monthlyData).slice(-6);

    // Conversion trend by campaign
    const campaignTrend = reactivationCampaigns.slice(-10).map((c, i) => ({
      campaign: `#${i + 1}`,
      conversionRate: c.recipients_count > 0 ? (c.converted_count / c.recipients_count) * 100 : 0,
      converted: c.converted_count,
      recipients: c.recipients_count,
      date: format(new Date(c.created_at), "dd/MM", { locale: ptBR }),
    }));

    // Campaign type distribution
    const typeDistribution = [
      { name: "Reativação", value: reactivationCampaigns.length, color: "hsl(var(--chart-1))" },
      { name: "Alerta Estoque", value: stockAlertCampaigns.length, color: "hsl(var(--chart-2))" },
    ];

    return {
      totalCampaigns: campaigns.length,
      reactivationCampaigns: reactivationCampaigns.length,
      stockAlertCampaigns: stockAlertCampaigns.length,
      totalReactivationRecipients,
      totalReactivationConverted,
      reactivationConversionRate,
      estimatedReactivationRevenue,
      reactivationCampaignCost,
      reactivationROI,
      totalStockAlerts,
      stockAlertRecipients,
      estimatedPreventedStockoutValue,
      monthlyBreakdown,
      campaignTrend,
      typeDistribution,
      netProfit: estimatedReactivationRevenue - reactivationCampaignCost,
    };
  }, [campaigns, averageOrderValue, campaignCost]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (campaigns.length === 0) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Nenhuma campanha para análise de ROI.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receita Estimada</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(roiMetrics.estimatedReactivationRevenue)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              De {roiMetrics.totalReactivationConverted} conversões
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ROI das Campanhas</p>
                <p className={`text-2xl font-bold ${roiMetrics.reactivationROI >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {roiMetrics.reactivationROI.toFixed(0)}%
                </p>
              </div>
              <div className={`p-3 rounded-full ${roiMetrics.reactivationROI >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                {roiMetrics.reactivationROI >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-green-500" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-500" />
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Lucro: {formatCurrency(roiMetrics.netProfit)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                <p className="text-2xl font-bold text-primary">
                  {roiMetrics.reactivationConversionRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Percent className="h-6 w-6 text-primary" />
              </div>
            </div>
            <Progress 
              value={Math.min(roiMetrics.reactivationConversionRate, 100)} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes Alcançados</p>
                <p className="text-2xl font-bold">
                  {roiMetrics.totalReactivationRecipients.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {roiMetrics.totalReactivationConverted} convertidos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Trend */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Receita Mensal
            </CardTitle>
            <CardDescription>Receita gerada por mês a partir de campanhas de reativação</CardDescription>
          </CardHeader>
          <CardContent>
            {roiMetrics.monthlyBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={roiMetrics.monthlyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={(v) => `R$${v/1000}k`} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Mês: ${label}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados suficientes</p>
            )}
          </CardContent>
        </Card>

        {/* Conversion Trend */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Evolução da Conversão
            </CardTitle>
            <CardDescription>Taxa de conversão das últimas 10 campanhas</CardDescription>
          </CardHeader>
          <CardContent>
            {roiMetrics.campaignTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={roiMetrics.campaignTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis tickFormatter={(v) => `${v}%`} className="text-xs" />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "conversionRate") return [`${value.toFixed(1)}%`, "Taxa Conversão"];
                      return [value, name];
                    }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="conversionRate" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2 }}
                    name="conversionRate"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados suficientes</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Campaign Type Distribution */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={roiMetrics.typeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {roiMetrics.typeDistribution.map((entry, index) => (
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
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROI Breakdown */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Análise de ROI</CardTitle>
            <CardDescription>Detalhamento de custos e receitas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Custo por contato</span>
              <span className="font-medium">{formatCurrency(campaignCost)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Custo total</span>
              <span className="font-medium text-red-500">
                -{formatCurrency(roiMetrics.reactivationCampaignCost)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Ticket médio</span>
              <span className="font-medium">{formatCurrency(averageOrderValue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Receita gerada</span>
              <span className="font-medium text-green-500">
                +{formatCurrency(roiMetrics.estimatedReactivationRevenue)}
              </span>
            </div>
            <hr className="border-border/50" />
            <div className="flex justify-between items-center">
              <span className="font-medium">Lucro líquido</span>
              <Badge variant={roiMetrics.netProfit >= 0 ? "default" : "destructive"}>
                {formatCurrency(roiMetrics.netProfit)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Performance Insights */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                ✓ {roiMetrics.totalReactivationConverted} clientes reativados
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Gerando {formatCurrency(roiMetrics.estimatedReactivationRevenue)} em receita estimada
              </p>
            </div>
            
            {roiMetrics.reactivationROI > 100 && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  ⭐ ROI acima de 100%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Campanhas estão gerando retorno excelente
                </p>
              </div>
            )}

            {roiMetrics.totalStockAlerts > 0 && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                  🔔 {roiMetrics.totalStockAlerts} alertas de estoque
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Prevenção estimada: {formatCurrency(roiMetrics.estimatedPreventedStockoutValue)}
                </p>
              </div>
            )}

            {roiMetrics.reactivationConversionRate > 5 && (
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                  📈 Conversão acima da média
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {roiMetrics.reactivationConversionRate.toFixed(1)}% vs média de mercado 2-5%
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
