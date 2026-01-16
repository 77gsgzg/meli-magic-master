import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { useOrders } from "@/hooks/useOrders";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Printer, Send, Truck } from "lucide-react";

export default function OrdersQueue() {
  const { loading: authLoading } = useRequireAuth();
  const { orders, loading, shipOrder, printLabel } = useOrders();

  const pending = useMemo(() => {
    return orders.filter((o) => o.status === "paid" && !o.shipped_at && o.shipping_status !== "shipped");
  }, [orders]);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkShipping, setBulkShipping] = useState(false);
  const [bulkPrinting, setBulkPrinting] = useState(false);

  const selectedOrders = pending.filter((o) => selected[o.ml_order_id]);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) pending.forEach((o) => (next[o.ml_order_id] = true));
    setSelected(next);
  };

  const runBulkShip = async () => {
    if (selectedOrders.length === 0) {
      toast.info("Selecione pelo menos um pedido");
      return;
    }

    setBulkShipping(true);
    try {
      for (const o of selectedOrders) {
        await shipOrder(o.ml_order_id);
      }
      toast.success("Processo de envio acionado para os pedidos selecionados");
      setSelected({});
    } finally {
      setBulkShipping(false);
    }
  };

  const runBulkPrint = async () => {
    const toPrint = selectedOrders.filter((o) => !!o.shipping_id).map((o) => o.shipping_id!)
    if (toPrint.length === 0) {
      toast.info("Nenhuma etiqueta disponível nos pedidos selecionados");
      return;
    }

    setBulkPrinting(true);
    try {
      for (const shipmentId of toPrint) {
        await printLabel(shipmentId);
      }
      toast.success("Etiquetas abertas em nova aba");
    } finally {
      setBulkPrinting(false);
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout title="Fila de Envios" subtitle="Carregando...">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Fila de Envios" subtitle="Somente pedidos pagos e ainda não enviados">
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Pedidos aguardando envio
          </CardTitle>
          <CardDescription>
            Ações em lote usam os dados reais já sincronizados; nenhum envio é permitido sem pedido pago.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Nenhum pedido pendente de envio.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={pending.length > 0 && selectedOrders.length === pending.length}
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedOrders.length} selecionado(s) • {pending.length} total
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={runBulkPrint} disabled={bulkPrinting}>
                    {bulkPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                    Imprimir etiquetas
                  </Button>
                  <Button onClick={runBulkShip} disabled={bulkShipping}>
                    {bulkShipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Enviar selecionados
                  </Button>
                </div>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border/50 overflow-hidden">
                {pending.map((o) => (
                  <div key={o.id} className="flex items-start gap-3 p-3 bg-background/40">
                    <Checkbox
                      className="mt-1"
                      checked={!!selected[o.ml_order_id]}
                      onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [o.ml_order_id]: !!v }))}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{o.item_title}</p>
                          <p className="text-xs text-muted-foreground truncate">Pedido #{o.ml_order_id} • {o.buyer_nickname}</p>
                        </div>
                        <Badge variant="outline">Pago</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {o.shipping_id ? (
                          <Button size="sm" variant="outline" onClick={() => printLabel(o.shipping_id!)}>
                            <Printer className="h-4 w-4 mr-2" />Etiqueta
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem etiqueta</span>
                        )}
                        <Button size="sm" onClick={() => shipOrder(o.ml_order_id)}>
                          <Send className="h-4 w-4 mr-2" />Enviar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
