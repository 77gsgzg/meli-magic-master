import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "./usePushNotifications";
import { toast } from "sonner";

interface PriceChangePayload {
  id: string;
  supplier_product_id: string;
  old_price: number;
  new_price: number;
  price_change_percent: number;
  detected_at: string;
  user_id: string;
}

interface SupplierProduct {
  id: string;
  title: string;
  supplier_name: string;
}

export function useSupplierPriceRealtime(
  userId: string | undefined,
  threshold: number = 10,
  enabled: boolean = true
) {
  const { sendNotification, isSupported, isEnabled } = usePushNotifications();

  const handlePriceChange = useCallback(
    async (payload: PriceChangePayload) => {
      // Only process if change exceeds threshold
      if (Math.abs(payload.price_change_percent) < threshold) {
        return;
      }

      // Fetch product details
      const { data: product } = await supabase
        .from("supplier_products")
        .select("title, supplier_name")
        .eq("id", payload.supplier_product_id)
        .single();

      const productTitle = product?.title || "Produto";
      const supplierName = product?.supplier_name || "Fornecedor";
      const changeType = payload.price_change_percent > 0 ? "aumentou" : "reduziu";
      const changePercent = Math.abs(payload.price_change_percent).toFixed(1);

      // Show toast notification
      toast.info(`💰 Preço ${changeType} ${changePercent}%`, {
        description: `${productTitle} (${supplierName}): R$ ${payload.old_price.toFixed(2)} → R$ ${payload.new_price.toFixed(2)}`,
        duration: 8000,
        action: {
          label: "Ver detalhes",
          onClick: () => window.location.href = "/supplier",
        },
      });

      // Show push notification if supported and enabled
      if (isSupported && isEnabled) {
        sendNotification(
          `💰 Preço ${changeType} ${changePercent}%`,
          {
            body: `${productTitle} de ${supplierName}: R$ ${payload.old_price.toFixed(2)} → R$ ${payload.new_price.toFixed(2)}`,
            tag: `price-change-${payload.id}`,
            icon: "/favicon.ico",
            requireInteraction: true,
          }
        );
      }
    },
    [threshold, sendNotification, isSupported, isEnabled]
  );

  useEffect(() => {
    if (!userId || !enabled) return;

    const channel = supabase
      .channel("supplier-price-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "supplier_price_history",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          handlePriceChange(payload.new as PriceChangePayload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled, handlePriceChange]);

  return {
    isRealtimeEnabled: enabled && !!userId,
    isPushSupported: isSupported,
    isPushEnabled: isEnabled,
  };
}
