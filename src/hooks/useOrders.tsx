import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useMercadoLivre } from './useMercadoLivre';
import { toast } from 'sonner';

export interface MLOrder {
  id: string;
  user_id: string;
  ml_order_id: string;
  ml_pack_id: string | null;
  product_id: string | null;
  status: string;
  date_created: string;
  date_closed: string | null;
  buyer_id: string;
  buyer_nickname: string;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  shipping_id: string | null;
  shipping_status: string | null;
  shipping_receiver_name: string | null;
  shipping_address_line: string | null;
  shipping_address_city: string | null;
  shipping_address_state: string | null;
  shipping_address_zip_code: string | null;
  shipping_address_country: string | null;
  ml_item_id: string;
  item_title: string;
  item_quantity: number;
  unit_price: number;
  currency_id: string | null;
  payment_status: string | null;
  total_amount: number | null;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
}

export function useOrders() {
  const { session } = useAuth();
  const { callMLApi, connection } = useMercadoLivre();
  const [orders, setOrders] = useState<MLOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchLocalOrders = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('ml_orders')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date_created', { ascending: false });

      if (error) throw error;
      setOrders((data as MLOrder[]) || []);
    } catch (error) {
      console.error('Error fetching local orders:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchLocalOrders();
  }, [fetchLocalOrders]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('ml_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ml_orders',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          fetchLocalOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchLocalOrders]);

  const syncOrders = async () => {
    if (!connection.connected) {
      toast.error('Conecte ao Mercado Livre primeiro');
      return;
    }

    setSyncing(true);
    try {
      const result = await callMLApi('sync_orders');
      
      if (result.synced_count !== undefined) {
        toast.success(`${result.synced_count} pedidos sincronizados`);
        await fetchLocalOrders();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Error syncing orders:', error);
      toast.error('Erro ao sincronizar pedidos');
    } finally {
      setSyncing(false);
    }
  };

  const getOrderDetails = async (orderId: string) => {
    try {
      const result = await callMLApi('get_order', { order_id: orderId });
      return result;
    } catch (error) {
      console.error('Error getting order details:', error);
      throw error;
    }
  };

  const getShipmentDetails = async (shipmentId: string) => {
    try {
      const result = await callMLApi('get_shipment', { shipment_id: shipmentId });
      return result;
    } catch (error) {
      console.error('Error getting shipment details:', error);
      throw error;
    }
  };

  const shipOrder = async (orderId: string) => {
    try {
      const result = await callMLApi('ship_order', { order_id: orderId });
      
      if (result.success) {
        toast.success('Envio iniciado com sucesso!');
        await fetchLocalOrders();
        return result;
      } else {
        toast.error(result.error || 'Erro ao iniciar envio');
        return null;
      }
    } catch (error) {
      console.error('Error shipping order:', error);
      toast.error('Erro ao processar envio');
      throw error;
    }
  };

  const printLabel = async (shipmentId: string) => {
    try {
      const result = await callMLApi('get_shipping_label', { shipment_id: shipmentId });
      
      if (result.url) {
        window.open(result.url, '_blank');
        return result;
      } else {
        toast.error('Etiqueta não disponível');
        return null;
      }
    } catch (error) {
      console.error('Error getting shipping label:', error);
      toast.error('Erro ao obter etiqueta');
      throw error;
    }
  };

  const getOrderStats = () => {
    const total = orders.length;
    const paid = orders.filter(o => o.status === 'paid').length;
    const shipped = orders.filter(o => o.shipping_status === 'shipped' || o.shipped_at).length;
    const pending = orders.filter(o => o.status === 'paid' && !o.shipped_at).length;
    const delivered = orders.filter(o => o.shipping_status === 'delivered' || o.delivered_at).length;

    return { total, paid, shipped, pending, delivered };
  };

  return {
    orders,
    loading,
    syncing,
    syncOrders,
    getOrderDetails,
    getShipmentDetails,
    shipOrder,
    printLabel,
    getOrderStats,
    refresh: fetchLocalOrders,
  };
}
