import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import { useDemandMetrics, HeatmapCell, LoyaltyBuyer, ProductDemand } from "@/hooks/useDemandMetrics";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RefreshCw, TrendingUp, TrendingDown, Minus, Award, Package, Clock, Sparkles, AlertTriangle, Send, Bell, FileDown, Mail } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { exportDemandPDF } from "@/utils/exportDemandPDF";

function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}h`);

const TIER_COLORS = {
  bronze: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  silver: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
  gold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  platinum: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const TIER_LABELS = {
  bronze: "Bronze",
  silver: "Prata",
  gold: "Ouro",
  platinum: "Platina",
};

function HeatmapChart({ data }: { data: HeatmapCell[] }) {
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);

  const getIntensity = (orders: number) => {
    if (orders === 0) return "bg-muted/30";
    const ratio = orders / maxOrders;
    if (ratio > 0.8) return "bg-primary";
    if (ratio > 0.6) return "bg-primary/80";
    if (ratio > 0.4) return "bg-primary/60";
    if (ratio > 0.2) return "bg-primary/40";
    return "bg-primary/20";
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex ml-12 mb-1">
          {HOUR_LABELS.filter((_, i) => i % 2 === 0).map((label, i) => (
            <div key={label} className="text-xs text-muted-foreground" style={{ width: "calc(100% / 12)", minWidth: 40 }}>
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        {DAY_LABELS.map((dayLabel, dayIndex) => (
          <div key={dayLabel} className="flex items-center mb-1">
            <div className="w-12 text-xs text-muted-foreground font-medium">{dayLabel}</div>
            <div className="flex flex-1 gap-0.5">
              {HOUR_LABELS.map((_, hourIndex) => {
                const cell = data.find((d) => d.dayOfWeek === dayIndex && d.hour === hourIndex);
                const orders = cell?.orders || 0;
                const revenue = cell?.revenue || 0;
                return (
                  <TooltipProvider key={`${dayIndex}-${hourIndex}`}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`h-6 flex-1 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${getIntensity(orders)}`}
                          style={{ minWidth: 16 }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{dayLabel} às {hourIndex}h</p>
                        <p className="text-sm">{orders} pedido(s)</p>
                        <p className="text-sm">{formatCurrencyBRL(revenue)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 ml-12">
          <span className="text-xs text-muted-foreground">Menos</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-sm bg-muted/30" />
            <div className="w-4 h-4 rounded-sm bg-primary/20" />
            <div className="w-4 h-4 rounded-sm bg-primary/40" />
            <div className="w-4 h-4 rounded-sm bg-primary/60" />
            <div className="w-4 h-4 rounded-sm bg-primary/80" />
            <div className="w-4 h-4 rounded-sm bg-primary" />
          </div>
          <span className="text-xs text-muted-foreground">Mais</span>
        </div>
      </div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function DemandForecast() {
  const { loading: authLoading, session } = useRequireAuth();
  const [period, setPeriod] = useState<"30" | "60" | "90">("90");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiForecast, setAiForecast] = useState<string | null>(null);
  const [reactivationLoading, setReactivationLoading] = useState(false);
  const [stockAlertLoading, setStockAlertLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [reactivationDialogOpen, setReactivationDialogOpen] = useState(false);
  const [stockAlertDialogOpen, setStockAlertDialogOpen] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(30);
  const [criticalDays, setCriticalDays] = useState(7);
  const [alertEmail, setAlertEmail] = useState(session?.user?.email || "");

  const { data, isLoading, error, refetch } = useDemandMetrics(Number(period));

  const generateAIForecast = async () => {
    if (!data?.productDemand?.length) {
      toast.error("Nenhum produto para analisar");
      return;
    }

    setAiLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("demand-forecast", {
        body: {
          products: data.productDemand.slice(0, 15),
        },
      });

      if (error) throw error;

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setAiForecast(result.forecast);
      toast.success("Previsão gerada com sucesso!");
    } catch (err: any) {
      console.error("Error generating forecast:", err);
      toast.error(err.message || "Erro ao gerar previsão");
    } finally {
      setAiLoading(false);
    }
  };

  const tierCounts = useMemo(() => {
    if (!data?.loyaltyBuyers) return { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    return data.loyaltyBuyers.reduce(
      (acc, b) => {
        acc[b.tier]++;
        return acc;
      },
      { bronze: 0, silver: 0, gold: 0, platinum: 0 }
    );
  }, [data?.loyaltyBuyers]);

  const lowStockProducts = useMemo(() => {
    if (!data?.productDemand) return [];
    return data.productDemand.filter((p) => p.daysOfStock !== null && p.daysOfStock < criticalDays);
  }, [data?.productDemand, criticalDays]);

  const inactiveBuyers = useMemo(() => {
    if (!data?.loyaltyBuyers) return [];
    return data.loyaltyBuyers.filter((b) => b.daysSinceLastOrder >= inactiveDays && b.email);
  }, [data?.loyaltyBuyers, inactiveDays]);

  const sendReactivationCampaign = async () => {
    if (inactiveBuyers.length === 0) {
      toast.error("Nenhum cliente inativo com e-mail disponível");
      return;
    }

    setReactivationLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("reactivation-campaign", {
        body: {
          buyers: inactiveBuyers.map(b => ({
            nickname: b.nickname,
            email: b.email,
            daysSinceLastOrder: b.daysSinceLastOrder,
            tier: b.tier,
            loyaltyScore: b.loyaltyScore,
            totalRevenue: b.totalRevenue,
          })),
        },
      });

      if (error) throw error;

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Campanha enviada: ${result.results.sent} e-mails, ${result.results.failed} falhas`);
      setReactivationDialogOpen(false);
    } catch (err: any) {
      console.error("Error sending reactivation campaign:", err);
      toast.error(err.message || "Erro ao enviar campanha");
    } finally {
      setReactivationLoading(false);
    }
  };

  const sendStockAlert = async () => {
    if (!alertEmail) {
      toast.error("Informe um e-mail para receber o alerta");
      return;
    }

    if (lowStockProducts.length === 0) {
      toast.error("Nenhum produto com estoque crítico");
      return;
    }

    setStockAlertLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("stock-alert", {
        body: {
          products: lowStockProducts,
          recipientEmail: alertEmail,
          criticalDays,
        },
      });

      if (error) throw error;

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Alerta enviado para ${alertEmail} com ${result.productCount} produtos`);
      setStockAlertDialogOpen(false);
    } catch (err: any) {
      console.error("Error sending stock alert:", err);
      toast.error(err.message || "Erro ao enviar alerta");
    } finally {
      setStockAlertLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!data) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    setPdfLoading(true);
    try {
      await exportDemandPDF(data, aiForecast);
      toast.success("Relatório PDF exportado com sucesso!");
    } catch (err: any) {
      console.error("Error exporting PDF:", err);
      toast.error(err.message || "Erro ao exportar PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout title="Previsão de Demanda" subtitle="Carregando...">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Previsão de Demanda"
      subtitle="Mapa de calor, fidelidade de clientes e reabastecimento inteligente"
    >
      {/* Filters */}
      <Card className="glass border-border/50 mb-4">
        <CardContent className="pt-4 flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-[150px]">
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="60">Últimos 60 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dialog open={reactivationDialogOpen} onOpenChange={setReactivationDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isLoading}>
                  <Send className="h-4 w-4 mr-2" />
                  Reativar Clientes ({inactiveBuyers.length})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Campanha de Reativação</DialogTitle>
                  <DialogDescription>
                    Enviar e-mails para clientes inativos com descontos baseados no tier de fidelidade.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Clientes inativos há mais de (dias)</Label>
                    <Input type="number" value={inactiveDays} onChange={(e) => setInactiveDays(Number(e.target.value))} min={7} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {inactiveBuyers.length} cliente(s) com e-mail serão contactados.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={sendReactivationCampaign} disabled={reactivationLoading || inactiveBuyers.length === 0}>
                    <Mail className="h-4 w-4 mr-2" />
                    {reactivationLoading ? "Enviando..." : "Enviar Campanha"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={stockAlertDialogOpen} onOpenChange={setStockAlertDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isLoading}>
                  <Bell className="h-4 w-4 mr-2" />
                  Alerta Estoque ({lowStockProducts.length})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alerta de Estoque Crítico</DialogTitle>
                  <DialogDescription>
                    Enviar relatório por e-mail com produtos em estoque baixo.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Estoque crítico (menos de X dias)</Label>
                    <Input type="number" value={criticalDays} onChange={(e) => setCriticalDays(Number(e.target.value))} min={1} />
                  </div>
                  <div>
                    <Label>E-mail para receber alerta</Label>
                    <Input type="email" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder="seu@email.com" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {lowStockProducts.length} produto(s) com estoque crítico.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={sendStockAlert} disabled={stockAlertLoading || lowStockProducts.length === 0}>
                    <Bell className="h-4 w-4 mr-2" />
                    {stockAlertLoading ? "Enviando..." : "Enviar Alerta"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={pdfLoading || isLoading || !data}>
              <FileDown className="h-4 w-4 mr-2" />
              {pdfLoading ? "Gerando..." : "Exportar PDF"}
            </Button>

            <Button onClick={generateAIForecast} disabled={aiLoading || isLoading}>
              <Sparkles className="h-4 w-4 mr-2" />
              {aiLoading ? "Gerando..." : "Previsão IA"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Horário de pico</p>
            </div>
            <p className="text-2xl font-bold">
              {data ? `${DAY_LABELS[data.peakDay]} ${data.peakHour}h` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-yellow-500" />
              <p className="text-sm text-muted-foreground">Score médio fidelidade</p>
            </div>
            <p className="text-2xl font-bold">{data?.avgLoyaltyScore ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-blue-500" />
              <p className="text-sm text-muted-foreground">Produtos analisados</p>
            </div>
            <p className="text-2xl font-bold">{data?.productDemand?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <p className="text-sm text-muted-foreground">Estoque baixo</p>
            </div>
            <p className="text-2xl font-bold">{lowStockProducts.length}</p>
            <p className="text-xs text-muted-foreground">Menos de 7 dias</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="heatmap" className="space-y-4">
        <TabsList>
          <TabsTrigger value="heatmap">Mapa de Calor</TabsTrigger>
          <TabsTrigger value="loyalty">Fidelidade</TabsTrigger>
          <TabsTrigger value="demand">Reabastecimento</TabsTrigger>
          {aiForecast && <TabsTrigger value="forecast">Previsão IA</TabsTrigger>}
        </TabsList>

        <TabsContent value="heatmap">
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle>Vendas por dia e hora</CardTitle>
              <CardDescription>
                Identifique os melhores momentos para promoções e campanhas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : data?.heatmap ? (
                <HeatmapChart data={data.heatmap} />
              ) : (
                <p className="text-muted-foreground">Sem dados disponíveis.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loyalty">
          <div className="grid gap-4 lg:grid-cols-4 mb-4">
            {(["platinum", "gold", "silver", "bronze"] as const).map((tier) => (
              <Card key={tier} className="glass border-border/50">
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <Badge className={TIER_COLORS[tier]}>{TIER_LABELS[tier]}</Badge>
                    <p className="text-2xl font-bold mt-2">{tierCounts[tier]}</p>
                  </div>
                  <Award className={`h-8 w-8 ${tier === "platinum" ? "text-purple-500" : tier === "gold" ? "text-yellow-500" : tier === "silver" ? "text-gray-400" : "text-orange-500"}`} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle>Ranking de fidelidade</CardTitle>
              <CardDescription>
                Compradores recorrentes ordenados por pontuação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (data?.loyaltyBuyers?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">Nenhum comprador recorrente encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Comprador</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Receita total</TableHead>
                        <TableHead className="text-right">Frequência</TableHead>
                        <TableHead className="text-right">Última compra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.loyaltyBuyers.map((b) => (
                        <TableRow key={b.nickname}>
                          <TableCell className="font-medium">{b.nickname}</TableCell>
                          <TableCell>
                            <Badge className={TIER_COLORS[b.tier]}>{TIER_LABELS[b.tier]}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold">{b.loyaltyScore}</TableCell>
                          <TableCell className="text-right">{b.totalOrders}</TableCell>
                          <TableCell className="text-right">{formatCurrencyBRL(b.totalRevenue)}</TableCell>
                          <TableCell className="text-right">{b.frequency}/mês</TableCell>
                          <TableCell className="text-right">
                            <span className={b.daysSinceLastOrder > 30 ? "text-orange-500" : ""}>
                              {b.daysSinceLastOrder}d atrás
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demand">
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle>Análise de demanda e reabastecimento</CardTitle>
              <CardDescription>
                Produtos ordenados por demanda média diária
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (data?.productDemand?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">Nenhum produto encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Vendidos</TableHead>
                        <TableHead className="text-right">Média/dia</TableHead>
                        <TableHead>Tendência</TableHead>
                        <TableHead className="text-right">Estoque</TableHead>
                        <TableHead className="text-right">Dias de estoque</TableHead>
                        <TableHead className="text-right">Reabastecer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.productDemand.map((p) => (
                        <TableRow key={p.mlItemId}>
                          <TableCell className="font-medium max-w-[250px] truncate">
                            {p.title}
                          </TableCell>
                          <TableCell className="text-right">{p.totalSold}</TableCell>
                          <TableCell className="text-right">{p.avgDaily}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <TrendIcon trend={p.trend} />
                              <span className="text-xs capitalize">{p.trend === "up" ? "Alta" : p.trend === "down" ? "Baixa" : "Estável"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {p.availableQuantity ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.daysOfStock !== null ? (
                              <Badge variant={p.daysOfStock < 7 ? "destructive" : p.daysOfStock < 14 ? "secondary" : "outline"}>
                                {p.daysOfStock}d
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {p.suggestedRestock > 0 ? (
                              <span className="text-primary">+{p.suggestedRestock}</span>
                            ) : (
                              <span className="text-muted-foreground">OK</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {aiForecast && (
          <TabsContent value="forecast">
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Previsão gerada por IA
                </CardTitle>
                <CardDescription>
                  Análise inteligente baseada no histórico de vendas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown>{aiForecast}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </DashboardLayout>
  );
}
