import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function useOrderPushAlerts() {
  const { session } = useAuth();
  const { isEnabled, sendNotification } = usePushNotifications();
  const lastNotifiedOrderId = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel("ml_orders_push_alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ml_orders",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          if (!isEnabled) return;
          const row = payload.new as any;
          const mlOrderId = row?.ml_order_id as string | undefined;
          if (!mlOrderId) return;

          // Prevent duplicate notifications from quick reconnects.
          if (lastNotifiedOrderId.current === mlOrderId) return;
          lastNotifiedOrderId.current = mlOrderId;

          sendNotification("Novo pedido recebido", {
            body: `${row?.item_title || "Produto"} • Pedido #${mlOrderId}`,
            tag: `ml-order-${mlOrderId}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, isEnabled, sendNotification]);
}
