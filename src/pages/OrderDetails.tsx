import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { useOrders, MLOrder } from "@/hooks/useOrders";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  Truck,
  User,
  MapPin,
  ArrowLeft,
  Printer,
  Send,
  CheckCircle,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  maskName,
  maskEmail,
  maskPhone,
  maskAddress,
  maskZip,
} from "@/lib/privacy";

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  shipped: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  ready_to_ship: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

const statusLabels: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  cancelled: "Cancelado",
  shipped: "Enviado",
  delivered: "Entregue",
  ready_to_ship: "Pronto p/ Envio",
};

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  date: Date | null;
  status: "completed" | "current" | "pending";
  icon: React.ReactNode;
}

function OrderTimeline({ order }: { order: MLOrder }) {
  const events: TimelineEvent[] = [
    {
      id: "created",
      title: "Pedido criado",
      description: "Pedido recebido do Mercado Livre",
      date: new Date(order.date_created),
      status: "completed",
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      id: "paid",
      title: "Pagamento confirmado",
      description: order.status === "paid" ? "Pagamento aprovado" : "Aguardando pagamento",
      date: order.status === "paid" ? new Date(order.date_created) : null,
      status: order.status === "paid" ? "completed" : order.status === "pending" ? "current" : "pending",
      icon: <CheckCircle className="h-4 w-4" />,
    },
    {
      id: "shipped",
      title: "Enviado",
      description: order.shipped_at ? "Produto despachado" : "Aguardando envio",
      date: order.shipped_at ? new Date(order.shipped_at) : null,
      status: order.shipped_at ? "completed" : order.status === "paid" ? "current" : "pending",
      icon: <Truck className="h-4 w-4" />,
    },
    {
      id: "delivered",
      title: "Entregue",
      description: order.delivered_at ? "Produto entregue ao comprador" : "Aguardando entrega",
      date: order.delivered_at ? new Date(order.delivered_at) : null,
      status: order.delivered_at ? "completed" : order.shipped_at ? "current" : "pending",
      icon: <Package className="h-4 w-4" />,
    },
  ];

  return (
    <div className="relative">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-4 pb-8 last:pb-0">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                event.status === "completed"
                  ? "bg-primary text-primary-foreground border-primary"
                  : event.status === "current"
                  ? "bg-background text-primary border-primary"
                  : "bg-muted text-muted-foreground border-muted-foreground/30"
              }`}
            >
              {event.icon}
            </div>
            {index < events.length - 1 && (
              <div
                className={`w-0.5 flex-1 mt-2 ${
                  event.status === "completed" ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{event.title}</h4>
              {event.date && (
                <span className="text-sm text-muted-foreground">
                  {format(event.date, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
            {event.date && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(event.date, { addSuffix: true, locale: ptBR })}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useRequireAuth();
  const { orders, loading, shipOrder, printLabel, decryptOrderPii } = useOrders();
  
  const [shippingOrder, setShippingOrder] = useState(false);
  const [order, setOrder] = useState<MLOrder | null>(null);
  const [decryptedOrder, setDecryptedOrder] = useState<MLOrder | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    if (!loading && orders.length > 0 && id) {
      const found = orders.find((o) => o.ml_order_id === id || o.id === id);
      setOrder(found || null);
    }
  }, [orders, loading, id]);

  // Decrypt PII when order is found
  useEffect(() => {
    if (order?.id && !decryptedOrder) {
      setDecrypting(true);
      decryptOrderPii(order.id)
        .then((decrypted) => {
          if (decrypted) setDecryptedOrder(decrypted);
        })
        .finally(() => setDecrypting(false));
    }
  }, [order?.id, decryptOrderPii, decryptedOrder]);

  const handleShipOrder = async () => {
    if (!order) return;
    setShippingOrder(true);
    try {
      await shipOrder(order.ml_order_id);
    } finally {
      setShippingOrder(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!order?.shipping_id) return;
    await printLabel(order.shipping_id);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Detalhes do Pedido" subtitle="Carregando...">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout title="Pedido não encontrado" subtitle="">
        <Card className="glass border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Pedido não encontrado</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              O pedido que você está procurando não existe ou não foi sincronizado ainda.
            </p>
            <Button onClick={() => navigate("/orders")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Pedidos
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const currentStatus = order.shipping_status || order.status;

  return (
    <DashboardLayout
      title={`Pedido #${order.ml_order_id}`}
      subtitle={order.item_title}
    >
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between">
        <Button variant="outline" onClick={() => navigate("/orders")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="flex gap-2">
          {order.status === "paid" && !order.shipped_at && (
            <Button onClick={handleShipOrder} disabled={shippingOrder}>
              {shippingOrder ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Marcar como Enviado
            </Button>
          )}
          {order.shipping_id && (
            <Button variant="outline" onClick={handlePrintLabel}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Etiqueta
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status and Timeline */}
          <Card className="glass border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Status do Pedido</CardTitle>
                <Badge
                  variant="outline"
                  className={statusColors[currentStatus] || statusColors.pending}
                >
                  {statusLabels[currentStatus] || currentStatus}
                </Badge>
              </div>
              <CardDescription>Acompanhe o progresso do pedido</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTimeline order={order} />
            </CardContent>
          </Card>

          {/* Product Info */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Produto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-lg">{order.item_title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">ID ML:</span>
                    <code className="text-sm bg-muted px-2 py-0.5 rounded">{order.ml_item_id}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(order.ml_item_id, "ID do item")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Quantidade</p>
                    <p className="font-medium">{order.item_quantity}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Preço unitário</p>
                    <p className="font-medium">
                      {order.currency_id} {order.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="font-medium text-lg">
                      {order.currency_id} {(order.total_amount || order.unit_price * order.item_quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Buyer Info */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Comprador
                {decrypting && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Usuário</p>
                <p className="font-medium">{order.buyer_nickname}</p>
              </div>
              {(decryptedOrder?.buyer_first_name || order.buyer_first_name) && (
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">
                    {decryptedOrder?.buyer_first_name || order.buyer_first_name}{' '}
                    {decryptedOrder?.buyer_last_name || order.buyer_last_name}
                  </p>
                </div>
              )}
              {(decryptedOrder?.buyer_email || order.buyer_email) && (
                <div>
                  <p className="text-sm text-muted-foreground">E-mail</p>
                  <p className="font-medium text-sm">
                    {decryptedOrder?.buyer_email || order.buyer_email}
                  </p>
                </div>
              )}
              {(decryptedOrder?.buyer_phone || order.buyer_phone) && (
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">
                    {decryptedOrder?.buyer_phone || order.buyer_phone}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {(decryptedOrder?.shipping_address_line || order.shipping_address_line) && (
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(decryptedOrder?.shipping_receiver_name || order.shipping_receiver_name) && (
                  <p className="font-medium">
                    {decryptedOrder?.shipping_receiver_name || order.shipping_receiver_name}
                  </p>
                )}
                <p className="text-sm">
                  {decryptedOrder?.shipping_address_line || order.shipping_address_line}
                </p>
                <p className="text-sm">
                  {decryptedOrder?.shipping_address_city || order.shipping_address_city},{' '}
                  {decryptedOrder?.shipping_address_state || order.shipping_address_state}
                </p>
                <p className="text-sm">
                  CEP: {decryptedOrder?.shipping_address_zip_code || order.shipping_address_zip_code}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tracking */}
          {order.tracking_number && (
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Rastreamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded flex-1">
                    {order.tracking_number}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(order.tracking_number!, "Código de rastreio")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {order.tracking_url && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Rastrear Envio
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dates */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Datas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Criado em</p>
                <p className="font-medium">
                  {format(new Date(order.date_created), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              {order.shipped_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Enviado em</p>
                  <p className="font-medium">
                    {format(new Date(order.shipped_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
              {order.delivered_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Entregue em</p>
                  <p className="font-medium">
                    {format(new Date(order.delivered_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
