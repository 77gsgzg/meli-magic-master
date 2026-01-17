import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { useBuyerMetrics } from "@/hooks/useBuyerMetrics";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Mail, Clock, Users, UserPlus, RefreshCw, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type Preset = "7" | "30" | "90";

export default function BuyerAnalytics() {
  const { loading: authLoading } = useRequireAuth();
  const [preset, setPreset] = useState<Preset>("30");
  const [delayThreshold, setDelayThreshold] = useState(48);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data, isLoading, error, refetch } = useBuyerMetrics({
    days: Number(preset),
    delayThresholdHours: delayThreshold,
  });

  const pieData = useMemo(() => {
    if (!data?.segments) return [];
    return data.segments.map((s) => ({
      name: s.type === "new" ? "Novos clientes" : "Recorrentes",
      value: s.count,
      revenue: s.revenue,
      fill: s.type === "new" ? "hsl(var(--primary))" : "hsl(217 91% 60%)",
    }));
  }, [data?.segments]);

  const handleSendReminder = async () => {
    if (!selectedOrder?.buyer_email) {
      toast.error("Este comprador não possui e-mail cadastrado");
      return;
    }

    setSending(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("send-delay-reminder", {
        body: {
          orderId: selectedOrder.id,
          buyerEmail: selectedOrder.buyer_email,
          buyerName: selectedOrder.buyer_first_name || selectedOrder.buyer_nickname,
          itemTitle: selectedOrder.item_title,
          hoursDelayed: selectedOrder.hoursDelayed,
          customMessage: customMessage || undefined,
        },
      });

      if (error) throw error;

      toast.success("E-mail de lembrete enviado com sucesso!");
      setEmailDialogOpen(false);
      setCustomMessage("");
      setSelectedOrder(null);
    } catch (err: any) {
      console.error("Error sending reminder:", err);
      toast.error(err.message || "Erro ao enviar e-mail");
    } finally {
      setSending(false);
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout title="Compradores" subtitle="Carregando...">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  const newSegment = data?.segments.find((s) => s.type === "new");
  const recurringSegment = data?.segments.find((s) => s.type === "recurring");

  return (
    <DashboardLayout
      title="Análise de Compradores"
      subtitle="Clientes novos vs recorrentes, picos de vendas e pedidos atrasados"
    >
      {/* Filters */}
      <Card className="glass border-border/50 mb-4">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="w-full md:w-[180px]">
            <p className="text-sm text-muted-foreground mb-1">Período</p>
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-[220px]">
            <p className="text-sm text-muted-foreground mb-1">Atraso mínimo (horas)</p>
            <Input
              type="number"
              min={1}
              value={delayThreshold}
              onChange={(e) => setDelayThreshold(Number(e.target.value) || 48)}
            />
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Novos clientes</p>
            </div>
            <p className="text-2xl font-bold">{newSegment?.count ?? 0}</p>
            <p className="text-sm text-muted-foreground">
              {newSegment?.percentage ?? 0}% dos pedidos
            </p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <p className="text-sm text-muted-foreground">Recorrentes</p>
            </div>
            <p className="text-2xl font-bold">{recurringSegment?.count ?? 0}</p>
            <p className="text-sm text-muted-foreground">
              {recurringSegment?.percentage ?? 0}% dos pedidos
            </p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <p className="text-sm text-muted-foreground">Pedidos atrasados</p>
            </div>
            <p className="text-2xl font-bold">{data?.delayedOrders.length ?? 0}</p>
            <p className="text-sm text-muted-foreground">
              Sem envio há {delayThreshold}h+
            </p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-5 w-5 text-green-500" />
              <p className="text-sm text-muted-foreground">Ticket médio recorrentes</p>
            </div>
            <p className="text-2xl font-bold">
              {recurringSegment?.avgOrderValue
                ? formatCurrencyBRL(recurringSegment.avgOrderValue)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* Buyer Segments Pie */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Segmentação de compradores</CardTitle>
            <CardDescription>Novos vs recorrentes no período</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : pieData.length === 0 || (pieData[0]?.value === 0 && pieData[1]?.value === 0) ? (
              <div className="text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: any, name: string, props: any) => [
                      `${value} pedidos (${formatCurrencyBRL(props.payload.revenue)})`,
                      name,
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Orders by Hour */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Pedidos por hora do dia</CardTitle>
            <CardDescription>Identifique picos de vendas</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.hourlyDistribution?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data!.hourlyDistribution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: any, name: string) => [
                      name === "orders" ? `${value} pedido(s)` : formatCurrencyBRL(value),
                      name === "orders" ? "Pedidos" : "Receita",
                    ]}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="orders" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Recurring Buyers */}
      <Card className="glass border-border/50 mb-6">
        <CardHeader>
          <CardTitle>Top compradores recorrentes</CardTitle>
          <CardDescription>Clientes que já compraram antes do período atual</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (data?.recurringBuyersList?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum comprador recorrente encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comprador</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.recurringBuyersList.map((b) => (
                    <TableRow key={b.nickname}>
                      <TableCell className="font-medium">{b.nickname}</TableCell>
                      <TableCell className="text-right">{b.orders}</TableCell>
                      <TableCell className="text-right">{formatCurrencyBRL(b.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delayed Orders Report */}
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Pedidos atrasados
          </CardTitle>
          <CardDescription>
            Pedidos pagos aguardando envio há mais de {delayThreshold} horas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (data?.delayedOrders?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum pedido atrasado encontrado. 🎉
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Atraso</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.delayedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.ml_order_id}</TableCell>
                      <TableCell>{order.buyer_nickname}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{order.item_title}</TableCell>
                      <TableCell className="text-right">
                        {order.total_amount ? formatCurrencyBRL(order.total_amount) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={order.hoursDelayed > 72 ? "destructive" : "secondary"}>
                          {order.hoursDelayed}h
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.buyer_email ? (
                          <Badge variant="outline" className="text-xs">
                            Disponível
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Indisponível
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!order.buyer_email}
                          onClick={() => {
                            setSelectedOrder(order);
                            setEmailDialogOpen(true);
                          }}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Lembrete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enviar lembrete de envio</DialogTitle>
            <DialogDescription>
              Enviar e-mail para {selectedOrder?.buyer_email} sobre o pedido #{selectedOrder?.ml_order_id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium mb-1">Produto</p>
              <p className="text-sm text-muted-foreground">{selectedOrder?.item_title}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Atraso</p>
              <Badge variant="destructive">{selectedOrder?.hoursDelayed}h sem envio</Badge>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Mensagem personalizada (opcional)</p>
              <Textarea
                placeholder="Deixe em branco para usar a mensagem padrão..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendReminder} disabled={sending}>
              {sending ? "Enviando..." : "Enviar e-mail"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
