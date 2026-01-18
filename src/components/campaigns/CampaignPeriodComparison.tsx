import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Legend,
} from "recharts";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  CalendarDays, 
  TrendingUp, 
  TrendingDown,
  Minus,
  ChevronRight
} from "lucide-react";
import { format, subMonths, subQuarters, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, isWithinInterval } from "date-fns";
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

interface CampaignPeriodComparisonProps {
  campaigns: CampaignHistory[];
  averageOrderValue?: number;
}

type PeriodType = "month" | "quarter";
type CompareCount = 2 | 3 | 4 | 6;

interface PeriodMetrics {
  label: string;
  startDate: Date;
  endDate: Date;
  campaigns: number;
  recipients: number;
  converted: number;
  conversionRate: number;
  revenue: number;
}

export function CampaignPeriodComparison({ 
  campaigns,
  averageOrderValue = 150 
}: CampaignPeriodComparisonProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [compareCount, setCompareCount] = useState<CompareCount>(3);

  const periodMetrics = useMemo(() => {
    const now = new Date();
    const periods: PeriodMetrics[] = [];

    for (let i = 0; i < compareCount; i++) {
      let startDate: Date;
      let endDate: Date;
      let label: string;

      if (periodType === "month") {
        const targetDate = subMonths(now, i);
        startDate = startOfMonth(targetDate);
        endDate = endOfMonth(targetDate);
        label = format(targetDate, "MMM/yy", { locale: ptBR });
      } else {
        const targetDate = subQuarters(now, i);
        startDate = startOfQuarter(targetDate);
        endDate = endOfQuarter(targetDate);
        const quarter = Math.ceil((targetDate.getMonth() + 1) / 3);
        label = `Q${quarter}/${format(targetDate, "yy")}`;
      }

      const periodCampaigns = campaigns.filter(c => {
        const campaignDate = new Date(c.created_at);
        return isWithinInterval(campaignDate, { start: startDate, end: endDate });
      });

      const reactivationCampaigns = periodCampaigns.filter(c => c.campaign_type === "reactivation");
      const recipients = reactivationCampaigns.reduce((sum, c) => sum + c.recipients_count, 0);
      const converted = reactivationCampaigns.reduce((sum, c) => sum + c.converted_count, 0);

      periods.push({
        label,
        startDate,
        endDate,
        campaigns: periodCampaigns.length,
        recipients,
        converted,
        conversionRate: recipients > 0 ? (converted / recipients) * 100 : 0,
        revenue: converted * averageOrderValue,
      });
    }

    return periods.reverse();
  }, [campaigns, periodType, compareCount, averageOrderValue]);

  const comparison = useMemo(() => {
    if (periodMetrics.length < 2) return null;

    const current = periodMetrics[periodMetrics.length - 1];
    const previous = periodMetrics[periodMetrics.length - 2];

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      campaigns: {
        current: current.campaigns,
        previous: previous.campaigns,
        change: calculateChange(current.campaigns, previous.campaigns),
      },
      recipients: {
        current: current.recipients,
        previous: previous.recipients,
        change: calculateChange(current.recipients, previous.recipients),
      },
      converted: {
        current: current.converted,
        previous: previous.converted,
        change: calculateChange(current.converted, previous.converted),
      },
      conversionRate: {
        current: current.conversionRate,
        previous: previous.conversionRate,
        change: current.conversionRate - previous.conversionRate,
      },
      revenue: {
        current: current.revenue,
        previous: previous.revenue,
        change: calculateChange(current.revenue, previous.revenue),
      },
    };
  }, [periodMetrics]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const ChangeIndicator = ({ value, isPercentage = false, suffix = "%" }: { value: number; isPercentage?: boolean; suffix?: string }) => {
    if (Math.abs(value) < 0.1) {
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Minus className="h-4 w-4" />
          <span className="text-sm">Estável</span>
        </div>
      );
    }

    const isPositive = value > 0;
    return (
      <div className={`flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : (
          <ArrowDownRight className="h-4 w-4" />
        )}
        <span className="text-sm font-medium">
          {isPositive ? "+" : ""}{value.toFixed(1)}{suffix}
        </span>
      </div>
    );
  };

  const chartData = periodMetrics.map(p => ({
    period: p.label,
    campanhas: p.campaigns,
    destinatarios: p.recipients,
    convertidos: p.converted,
    receita: p.revenue,
    conversao: p.conversionRate,
  }));

  if (campaigns.length === 0) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Nenhuma campanha para comparar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="glass border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Comparativo de Períodos
              </CardTitle>
              <CardDescription>Compare a performance entre diferentes períodos</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mensal</SelectItem>
                  <SelectItem value="quarter">Trimestral</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(compareCount)} onValueChange={(v) => setCompareCount(Number(v) as CompareCount)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 períodos</SelectItem>
                  <SelectItem value="3">3 períodos</SelectItem>
                  <SelectItem value="4">4 períodos</SelectItem>
                  <SelectItem value="6">6 períodos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Period Comparison Cards */}
      {comparison && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Campanhas</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold">{comparison.campaigns.current}</p>
                <ChangeIndicator value={comparison.campaigns.change} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Anterior: {comparison.campaigns.previous}
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Destinatários</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold">{comparison.recipients.current.toLocaleString()}</p>
                <ChangeIndicator value={comparison.recipients.change} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Anterior: {comparison.recipients.previous.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Convertidos</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-green-600">{comparison.converted.current}</p>
                <ChangeIndicator value={comparison.converted.change} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Anterior: {comparison.converted.previous}
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Taxa Conversão</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-primary">{comparison.conversionRate.current.toFixed(1)}%</p>
                <ChangeIndicator value={comparison.conversionRate.change} suffix="pp" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Anterior: {comparison.conversionRate.previous.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Receita</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(comparison.revenue.current)}</p>
                <ChangeIndicator value={comparison.revenue.change} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Anterior: {formatCurrency(comparison.revenue.previous)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Receita</TabsTrigger>
          <TabsTrigger value="conversion">Conversão</TabsTrigger>
          <TabsTrigger value="volume">Volume</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle>Evolução da Receita</CardTitle>
              <CardDescription>Receita estimada por período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis tickFormatter={(v) => `R$${v/1000}k`} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="receita" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversion">
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle>Evolução da Conversão</CardTitle>
              <CardDescription>Taxa de conversão por período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis tickFormatter={(v) => `${v}%`} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="conversao" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2, r: 5 }}
                    name="Taxa de Conversão"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volume">
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle>Volume de Campanhas</CardTitle>
              <CardDescription>Destinatários e conversões por período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="destinatarios" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} name="Destinatários" />
                  <Bar dataKey="convertidos" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} name="Convertidos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Period Details Table */}
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle>Detalhes por Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Período</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Campanhas</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Destinatários</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Convertidos</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Conversão</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Receita</th>
                </tr>
              </thead>
              <tbody>
                {periodMetrics.map((period, index) => (
                  <tr key={period.label} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={index === periodMetrics.length - 1 ? "default" : "secondary"}>
                          {period.label}
                        </Badge>
                        {index === periodMetrics.length - 1 && (
                          <span className="text-xs text-muted-foreground">Atual</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-3 px-4 font-medium">{period.campaigns}</td>
                    <td className="text-center py-3 px-4">{period.recipients.toLocaleString()}</td>
                    <td className="text-center py-3 px-4 text-green-600 font-medium">{period.converted}</td>
                    <td className="text-center py-3 px-4">
                      <Badge variant={period.conversionRate > 5 ? "default" : "secondary"}>
                        {period.conversionRate.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="text-right py-3 px-4 font-medium">{formatCurrency(period.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
