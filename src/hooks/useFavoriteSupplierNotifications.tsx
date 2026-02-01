import { useEffect, useCallback, useRef } from "react";
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

interface NewProductPayload {
  id: string;
  title: string;
  supplier_name: string;
  price: number | null;
  user_id: string;
  created_at: string;
}

export function useFavoriteSupplierNotifications(
  userId: string | undefined,
  priceThreshold: number = 5,
  enabled: boolean = true
) {
  const { sendNotification, isSupported, isEnabled } = usePushNotifications();

  // Use refs to avoid recreating callbacks
  const priceThresholdRef = useRef(priceThreshold);
  priceThresholdRef.current = priceThreshold;

  const pushStateRef = useRef({ isSupported, isEnabled });
  pushStateRef.current = { isSupported, isEnabled };

  const sendNotificationRef = useRef(sendNotification);
  sendNotificationRef.current = sendNotification;

  // Get favorite supplier names for filtering - memoized by userId only
  const getFavoriteSuppliers = useCallback(async (): Promise<string[]> => {
    if (!userId) return [];

    try {
      const { data } = await supabase
        .from("discovered_suppliers")
        .select("name")
        .eq("user_id", userId)
        .eq("is_favorite", true)
        .eq("alert_new_products", true);

      return data?.map(s => s.name) || [];
    } catch (error) {
      console.error("Error fetching favorite suppliers:", error);
      return [];
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !enabled) return;

    // Handle price change from favorite suppliers
    const handlePriceChange = async (payload: PriceChangePayload) => {
      if (Math.abs(payload.price_change_percent) < priceThresholdRef.current) {
        return;
      }

      try {
        // Fetch product details
        const { data: product } = await supabase
          .from("supplier_products")
          .select("title, supplier_name")
          .eq("id", payload.supplier_product_id)
          .single();

        if (!product) return;

        // Check if supplier is a favorite with alerts enabled
        const favoriteSuppliers = await getFavoriteSuppliers();
        if (!favoriteSuppliers.includes(product.supplier_name)) {
          return;
        }

        const productTitle = product.title || "Produto";
        const supplierName = product.supplier_name || "Fornecedor";
        const changeType = payload.price_change_percent > 0 ? "subiu" : "caiu";
        const changePercent = Math.abs(payload.price_change_percent).toFixed(1);
        const emoji = payload.price_change_percent > 0 ? "📈" : "📉";

        // Show toast notification
        toast.info(`${emoji} Preço ${changeType} ${changePercent}%`, {
          description: `${productTitle} (${supplierName}): R$ ${payload.old_price.toFixed(2)} → R$ ${payload.new_price.toFixed(2)}`,
          duration: 10000,
          action: {
            label: "Ver fornecedor",
            onClick: () => (window.location.href = "/supplier?tab=favorites"),
          },
        });

        // Send push notification
        const { isSupported: pushSupported, isEnabled: pushEnabled } = pushStateRef.current;
        if (pushSupported && pushEnabled) {
          sendNotificationRef.current(`${emoji} ${supplierName} - Preço ${changeType}!`, {
            body: `${productTitle}: R$ ${payload.old_price.toFixed(2)} → R$ ${payload.new_price.toFixed(2)} (${changePercent}%)`,
            tag: `fav-price-${payload.id}`,
            icon: "/favicon.ico",
            requireInteraction: true,
          });
        }
      } catch (error) {
        console.error("Error handling price change:", error);
      }
    };

    // Handle new products from favorite suppliers
    const handleNewProduct = async (payload: NewProductPayload) => {
      try {
        const favoriteSuppliers = await getFavoriteSuppliers();
        if (!favoriteSuppliers.includes(payload.supplier_name)) {
          return;
        }

        const price = payload.price
          ? `R$ ${payload.price.toFixed(2)}`
          : "Preço não disponível";

        // Show toast notification
        toast.info(`🆕 Novo produto de ${payload.supplier_name}`, {
          description: `${payload.title} - ${price}`,
          duration: 8000,
          action: {
            label: "Ver produtos",
            onClick: () => (window.location.href = "/supplier?tab=products"),
          },
        });

        // Send push notification
        const { isSupported: pushSupported, isEnabled: pushEnabled } = pushStateRef.current;
        if (pushSupported && pushEnabled) {
          sendNotificationRef.current(`🆕 Novo produto de ${payload.supplier_name}!`, {
            body: `${payload.title} - ${price}`,
            tag: `fav-new-${payload.id}`,
            icon: "/favicon.ico",
            requireInteraction: false,
          });
        }
      } catch (error) {
        console.error("Error handling new product:", error);
      }
    };

    // Subscribe to price changes
    const priceChannel = supabase
      .channel("favorite-supplier-prices")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "supplier_price_history",
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          handlePriceChange(payload.new as PriceChangePayload);
        }
      )
      .subscribe();

    // Subscribe to new products
    const productChannel = supabase
      .channel("favorite-supplier-products")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "supplier_products",
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          handleNewProduct(payload.new as NewProductPayload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(priceChannel);
      supabase.removeChannel(productChannel);
    };
  }, [userId, enabled, getFavoriteSuppliers]);

  return {
    isRealtimeEnabled: enabled && !!userId,
    isPushSupported: isSupported,
    isPushEnabled: isEnabled,
  };
}
