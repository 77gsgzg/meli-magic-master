import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { useOrders, MLOrder } from '@/hooks/useOrders';
import { useMercadoLivre } from '@/hooks/useMercadoLivre';
import { useOrderPushAlerts } from '@/hooks/useOrderPushAlerts';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useShippingDelayAlerts } from '@/hooks/useShippingDelayAlerts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedCard, AnimatedCardContent } from '@/components/ui/animated-card';
import { Button } from '@/components/ui/button';
import { AnimatedButton } from '@/components/ui/animated-button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { EmptyOrders } from '@/components/ui/empty-state';
import { StaggerContainer, StaggerItem } from '@/components/ui/motion-wrapper';
import {
  AnimatedTable,
  AnimatedTableHeader,
  AnimatedTableBody,
  AnimatedTableRow,
  AnimatedTableHead,
  AnimatedTableCell,
} from '@/components/ui/animated-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Package,
  Truck,
  RefreshCw,
  Search,
  ShoppingBag,
  MapPin,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Printer,
  Send,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusColors: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-600 border-green-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
  shipped: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  ready_to_ship: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

const statusLabels: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  shipped: 'Enviado',
  delivered: 'Entregue',
  ready_to_ship: 'Pronto p/ Envio',
};

export default function Orders() {
  const { loading: authLoading } = useRequireAuth();
  const { connection, loading: mlLoading } = useMercadoLivre();
  const { orders, loading, syncing, syncOrders, shipOrder, printLabel, getOrderStats } = useOrders();
  const navigate = useNavigate();

  useOrderPushAlerts();
  useShippingDelayAlerts();
  const push = usePushNotifications();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<MLOrder | null>(null);
  const [shippingOrder, setShippingOrder] = useState<string | null>(null);

  if (authLoading || mlLoading) {
    return (
      <DashboardLayout title="Pedidos" subtitle="Carregando...">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!connection.connected) {
    return (
      <DashboardLayout title="Pedidos" subtitle="Gerencie suas vendas">
        <Card className="glass border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Mercado Livre não conectado</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Para ver seus pedidos, você precisa conectar sua conta do Mercado Livre.
            </p>
            <Button asChild>
              <a href="/mercado-livre">Conectar Mercado Livre</a>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const stats = getOrderStats();

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.item_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.buyer_nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.ml_order_id.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || 
      order.status === statusFilter || 
      order.shipping_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleShipOrder = async (orderId: string) => {
    setShippingOrder(orderId);
    try {
      await shipOrder(orderId);
    } finally {
      setShippingOrder(null);
    }
  };

  const handlePrintLabel = async (shipmentId: string) => {
    await printLabel(shipmentId);
  };

  return (
    <DashboardLayout 
      title="Pedidos" 
      subtitle="Gerencie vendas e envios do Mercado Livre"
    >
      {/* Stats Cards with Stagger Animation */}
      <StaggerContainer className="grid gap-4 md:grid-cols-4 mb-6">
        <StaggerItem>
          <AnimatedCard variant="glass" enableHover enableGlow enableTap>
            <AnimatedCardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <ShoppingBag className="h-8 w-8 text-primary opacity-50" />
              </div>
            </AnimatedCardContent>
          </AnimatedCard>
        </StaggerItem>

        <StaggerItem>
          <AnimatedCard variant="glass" enableHover enableGlow enableTap>
            <AnimatedCardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aguardando Envio</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600 opacity-50" />
              </div>
            </AnimatedCardContent>
          </AnimatedCard>
        </StaggerItem>

        <StaggerItem>
          <AnimatedCard variant="glass" enableHover enableGlow enableTap>
            <AnimatedCardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Enviados</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.shipped}</p>
                </div>
                <Truck className="h-8 w-8 text-blue-600 opacity-50" />
              </div>
            </AnimatedCardContent>
          </AnimatedCard>
        </StaggerItem>

        <StaggerItem>
          <AnimatedCard variant="glass" enableHover enableGlow enableTap>
            <AnimatedCardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entregues</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.delivered}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-emerald-600 opacity-50" />
              </div>
            </AnimatedCardContent>
          </AnimatedCard>
        </StaggerItem>
      </StaggerContainer>

      {/* Filters and Actions */}
      <Card className="glass border-border/50 mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por produto, comprador ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                  <SelectItem value="shipped">Enviados</SelectItem>
                  <SelectItem value="delivered">Entregues</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {push.isSupported && (
                <Button
                  variant="outline"
                  onClick={() => (push.isEnabled ? push.disableNotifications() : push.enableNotifications())}
                >
                  {push.isEnabled ? 'Notificações: ON' : 'Ativar Notificações'}
                </Button>
              )}

              <AnimatedButton onClick={syncOrders} disabled={syncing} enableGlow>
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar Pedidos
              </AnimatedButton>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
          <CardDescription>
            Todos os pedidos são obtidos diretamente da API oficial do Mercado Livre
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <EmptyOrders onAction={orders.length === 0 ? syncOrders : undefined} />
          ) : (
            <AnimatedTable>
              <AnimatedTableHeader>
                <tr className="border-b border-border/50">
                  <AnimatedTableHead className="px-4 py-3">Produto</AnimatedTableHead>
                  <AnimatedTableHead className="px-4 py-3">Comprador</AnimatedTableHead>
                  <AnimatedTableHead className="px-4 py-3">Valor</AnimatedTableHead>
                  <AnimatedTableHead className="px-4 py-3">Status</AnimatedTableHead>
                  <AnimatedTableHead className="px-4 py-3">Data</AnimatedTableHead>
                  <AnimatedTableHead className="px-4 py-3 text-right">Ações</AnimatedTableHead>
                </tr>
              </AnimatedTableHeader>
              <AnimatedTableBody>
                {filteredOrders.map((order) => (
                  <AnimatedTableRow 
                    key={order.id} 
                    enableHover
                    enableTap
                    onClick={() => navigate(`/orders/${order.ml_order_id}`)}
                  >
                    <AnimatedTableCell className="px-4 py-3">
                      <div className="max-w-[250px]">
                        <p className="font-medium truncate">{order.item_title}</p>
                        <p className="text-xs text-muted-foreground">
                          Qtd: {order.item_quantity} • ID: {order.ml_order_id}
                        </p>
                      </div>
                    </AnimatedTableCell>
                    <AnimatedTableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{order.buyer_nickname}</span>
                      </div>
                    </AnimatedTableCell>
                    <AnimatedTableCell className="px-4 py-3">
                      <span className="font-medium">
                        {order.currency_id} {order.total_amount?.toFixed(2) || order.unit_price.toFixed(2)}
                      </span>
                    </AnimatedTableCell>
                    <AnimatedTableCell className="px-4 py-3">
                      <Badge 
                        variant="outline" 
                        className={statusColors[order.shipping_status || order.status] || statusColors.pending}
                      >
                        {statusLabels[order.shipping_status || order.status] || order.status}
                      </Badge>
                    </AnimatedTableCell>
                    <AnimatedTableCell className="px-4 py-3">
                      <div className="text-sm">
                        <p>{format(new Date(order.date_created), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(order.date_created), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </AnimatedTableCell>
                    <AnimatedTableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/orders/${order.ml_order_id}`)}
                        >
                          Detalhes
                        </Button>
                        {order.status === 'paid' && !order.shipped_at && (
                          <Button
                            size="sm"
                            onClick={() => handleShipOrder(order.ml_order_id)}
                            disabled={shippingOrder === order.ml_order_id}
                          >
                            {shippingOrder === order.ml_order_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-1" />
                                Enviar
                              </>
                            )}
                          </Button>
                        )}
                        {order.shipping_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintLabel(order.shipping_id!)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </AnimatedTableCell>
                  </AnimatedTableRow>
                ))}
              </AnimatedTableBody>
            </AnimatedTable>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
            <DialogDescription>
              Pedido #{selectedOrder?.ml_order_id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              {/* Product Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Produto
                </h4>
                <p className="font-medium">{selectedOrder.item_title}</p>
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                  <span>Quantidade: {selectedOrder.item_quantity}</span>
                  <span>
                    Valor: {selectedOrder.currency_id} {selectedOrder.unit_price.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Buyer Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Comprador
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Usuário:</span>
                    <span className="ml-2 font-medium">{selectedOrder.buyer_nickname}</span>
                  </div>
                  {selectedOrder.buyer_first_name && (
                    <div>
                      <span className="text-muted-foreground">Nome:</span>
                      <span className="ml-2">
                        {selectedOrder.buyer_first_name} {selectedOrder.buyer_last_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              {selectedOrder.shipping_address_line && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço de Entrega
                  </h4>
                  <div className="text-sm space-y-1">
                    {selectedOrder.shipping_receiver_name && (
                      <p className="font-medium">{selectedOrder.shipping_receiver_name}</p>
                    )}
                    <p>{selectedOrder.shipping_address_line}</p>
                    <p>
                      {selectedOrder.shipping_address_city}, {selectedOrder.shipping_address_state}
                    </p>
                    <p>CEP: {selectedOrder.shipping_address_zip_code}</p>
                  </div>
                </div>
              )}

              {/* Tracking */}
              {selectedOrder.tracking_number && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Rastreamento
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{selectedOrder.tracking_number}</span>
                    {selectedOrder.tracking_url && (
                      <Button variant="link" size="sm" asChild>
                        <a href={selectedOrder.tracking_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Rastrear
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                {selectedOrder.shipping_id && (
                  <Button
                    variant="outline"
                    onClick={() => handlePrintLabel(selectedOrder.shipping_id!)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Etiqueta
                  </Button>
                )}
                {selectedOrder.status === 'paid' && !selectedOrder.shipped_at && (
                  <Button
                    onClick={() => {
                      handleShipOrder(selectedOrder.ml_order_id);
                      setSelectedOrder(null);
                    }}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Produto
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
