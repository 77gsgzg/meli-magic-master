import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useOrderAlertSettings } from "@/hooks/useOrderAlertSettings";

/**
 * Hook that monitors orders and sends push notifications when shipping is delayed
 * beyond the configured threshold.
 */
export function useShippingDelayAlerts() {
  const { session } = useAuth();
  const { isEnabled, sendNotification } = usePushNotifications();
  const { settings } = useOrderAlertSettings();
  const notifiedOrdersRef = useRef<Set<string>>(new Set());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkDelayedOrders = useCallback(async () => {
    if (!session?.user?.id) return;
    if (!settings.shipping_delay_alert_enabled) return;
    if (!isEnabled) return;

    const delayThresholdMs = settings.shipping_delay_hours * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - delayThresholdMs).toISOString();

    try {
      // Find paid orders that haven't been shipped and were created before the cutoff
      const { data: delayedOrders, error } = await supabase
        .from("ml_orders")
        .select("id, ml_order_id, item_title, date_created")
        .eq("user_id", session.user.id)
        .eq("status", "paid")
        .is("shipped_at", null)
        .lt("date_created", cutoffDate)
        .limit(20);

      if (error) {
        console.error("Error checking delayed orders:", error);
        return;
      }

      for (const order of delayedOrders || []) {
        const orderId = order.ml_order_id;
        
        // Skip if already notified
        if (notifiedOrdersRef.current.has(orderId)) continue;
        
        // Calculate hours since order was created
        const createdAt = new Date(order.date_created);
        const hoursSinceCreated = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));

        // Send notification
        sendNotification("⚠️ Atraso no envio", {
          body: `Pedido #${orderId} aguarda envio há ${hoursSinceCreated}h: ${order.item_title?.slice(0, 50)}...`,
          tag: `shipping-delay-${orderId}`,
          requireInteraction: true,
        });

        // Mark as notified
        notifiedOrdersRef.current.add(orderId);

        // Log the alert to operation_logs
        await supabase.from("operation_logs").insert({
          user_id: session.user.id,
          operation_type: "update",
          entity_type: "order",
          entity_id: order.id,
          status: "warning",
          details: {
            alert_type: "shipping_delay",
            ml_order_id: orderId,
            hours_delayed: hoursSinceCreated,
            threshold_hours: settings.shipping_delay_hours,
          },
        });
      }
    } catch (err) {
      console.error("Error in shipping delay check:", err);
    }
  }, [session?.user?.id, settings.shipping_delay_alert_enabled, settings.shipping_delay_hours, isEnabled, sendNotification]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (!settings.shipping_delay_alert_enabled) return;

    // Check immediately on mount
    checkDelayedOrders();

    // Check every 15 minutes
    checkIntervalRef.current = setInterval(checkDelayedOrders, 15 * 60 * 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [session?.user?.id, settings.shipping_delay_alert_enabled, checkDelayedOrders]);

  // Reset notified orders set daily to allow re-notification
  useEffect(() => {
    const resetInterval = setInterval(() => {
      notifiedOrdersRef.current.clear();
    }, 24 * 60 * 60 * 1000);

    return () => clearInterval(resetInterval);
  }, []);

  return {
    checkDelayedOrders,
    notifiedCount: notifiedOrdersRef.current.size,
  };
}
