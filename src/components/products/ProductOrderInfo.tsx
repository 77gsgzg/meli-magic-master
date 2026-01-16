import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { User, MapPin, Truck, Package, Send, ExternalLink, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProductOrderInfoProps {
  productId: string;
  onShip?: (orderId: string) => void;
}

interface OrderInfo {
  id: string;
  ml_order_id: string;
  status: string;
  shipping_status: string | null;
  buyer_nickname: string;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  shipping_receiver_name: string | null;
  shipping_address_line: string | null;
  shipping_address_city: string | null;
  shipping_address_state: string | null;
  shipping_address_zip_code: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  date_created: string;
  shipped_at: string | null;
}

const statusColors: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-600 border-green-500/20',
  shipped: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

const statusLabels: Record<string, string> = {
  paid: 'Vendido - Aguardando Envio',
  shipped: 'Enviado',
  delivered: 'Entregue',
};

export function ProductOrderInfo({ productId, onShip }: ProductOrderInfoProps) {
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('ml_orders')
          .select(`
            id,
            ml_order_id,
            status,
            shipping_status,
            buyer_nickname,
            buyer_first_name,
            buyer_last_name,
            shipping_receiver_name,
            shipping_address_line,
            shipping_address_city,
            shipping_address_state,
            shipping_address_zip_code,
            tracking_number,
            tracking_url,
            date_created,
            shipped_at
          `)
          .eq('product_id', productId)
          .order('date_created', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setOrder(data);
        }
      } catch (error) {
        console.error('Error fetching order info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [productId]);

  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!order) {
    return null;
  }

  const canShip = order.status === 'paid' && !order.shipped_at;
  const displayStatus = order.shipping_status || order.status;

  return (
    <Card className="glass border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Pedido Vinculado
          </CardTitle>
          <Badge 
            variant="outline" 
            className={statusColors[displayStatus] || 'bg-muted'}
          >
            {statusLabels[displayStatus] || displayStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order ID and Date */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pedido #{order.ml_order_id}</span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(new Date(order.date_created), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>

        {/* Buyer Info */}
        <div className="p-3 rounded-lg bg-background/50">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Comprador</span>
          </div>
          <p className="text-sm">{order.buyer_nickname}</p>
          {order.buyer_first_name && (
            <p className="text-sm text-muted-foreground">
              {order.buyer_first_name} {order.buyer_last_name}
            </p>
          )}
        </div>

        {/* Shipping Address */}
        {order.shipping_address_line && (
          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Endereço de Entrega</span>
            </div>
            <div className="text-sm space-y-0.5">
              {order.shipping_receiver_name && (
                <p className="font-medium">{order.shipping_receiver_name}</p>
              )}
              <p>{order.shipping_address_line}</p>
              <p>{order.shipping_address_city}, {order.shipping_address_state}</p>
              <p>CEP: {order.shipping_address_zip_code}</p>
            </div>
          </div>
        )}

        {/* Tracking */}
        {order.tracking_number && (
          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Rastreamento</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{order.tracking_number}</span>
              {order.tracking_url && (
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Rastrear
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Ship Button */}
        {canShip && onShip && (
          <Button 
            className="w-full" 
            onClick={() => onShip(order.ml_order_id)}
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar Produto
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
