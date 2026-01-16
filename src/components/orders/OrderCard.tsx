import { MLOrder } from '@/hooks/useOrders';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, User, MapPin, Truck, Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderCardProps {
  order: MLOrder;
  onShip?: (orderId: string) => void;
  onViewDetails?: (order: MLOrder) => void;
  isShipping?: boolean;
}

const statusColors: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-600 border-green-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
  shipped: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

const statusLabels: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  shipped: 'Enviado',
  delivered: 'Entregue',
};

export function OrderCard({ order, onShip, onViewDetails, isShipping }: OrderCardProps) {
  const canShip = order.status === 'paid' && !order.shipped_at;

  return (
    <Card className="glass border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{order.item_title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>Qtd: {order.item_quantity}</span>
                  <span>•</span>
                  <span className="font-medium text-foreground">
                    {order.currency_id} {order.total_amount?.toFixed(2) || order.unit_price.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Buyer & Shipping */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{order.buyer_nickname}</span>
            </div>
            
            {order.shipping_address_city && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{order.shipping_address_city}, {order.shipping_address_state}</span>
              </div>
            )}

            {order.tracking_number && (
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-blue-500" />
                <span className="font-mono text-xs">{order.tracking_number}</span>
              </div>
            )}
          </div>

          {/* Status & Actions */}
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline" 
              className={statusColors[order.shipping_status || order.status] || statusColors.pending}
            >
              {statusLabels[order.shipping_status || order.status] || order.status}
            </Badge>

            <div className="text-sm text-muted-foreground">
              {format(new Date(order.date_created), 'dd/MM', { locale: ptBR })}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails?.(order)}
              >
                Detalhes
              </Button>
              
              {canShip && onShip && (
                <Button
                  size="sm"
                  onClick={() => onShip(order.ml_order_id)}
                  disabled={isShipping}
                >
                  {isShipping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Enviar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
