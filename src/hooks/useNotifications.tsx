import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type NotificationType = "order" | "product" | "warning" | "info" | "price";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  link?: string;
}

const STORAGE_KEY = "app-notifications";
const MAX_NOTIFICATIONS = 50;

export function useNotifications() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        }));
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = useCallback((notification: Omit<AppNotification, "id" | "read" | "createdAt">) => {
    const newNotification: AppNotification = {
      ...notification,
      id: crypto.randomUUID(),
      read: false,
      createdAt: new Date(),
    };

    setNotifications((prev) => {
      const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      return updated;
    });

    return newNotification;
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Listen for new orders
  useEffect(() => {
    if (!session?.user?.id) return;

    const ordersChannel = supabase
      .channel("notifications-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ml_orders",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const order = payload.new as any;
          addNotification({
            type: "order",
            title: "Novo pedido recebido",
            message: `${order.item_title || "Produto"} • Pedido #${order.ml_order_id}`,
            link: `/orders/${order.ml_order_id}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [session?.user?.id, addNotification]);

  // Listen for supplier price changes
  useEffect(() => {
    if (!session?.user?.id) return;

    const priceChannel = supabase
      .channel("notifications-prices")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "supplier_price_history",
          filter: `user_id=eq.${session.user.id}`,
        },
        async (payload) => {
          const priceChange = payload.new as any;
          
          // Only notify for significant changes (>5%)
          if (Math.abs(priceChange.price_change_percent) < 5) return;

          // Get product details
          const { data: product } = await supabase
            .from("supplier_products")
            .select("title, supplier_name")
            .eq("id", priceChange.supplier_product_id)
            .single();

          const changeType = priceChange.price_change_percent > 0 ? "aumentou" : "reduziu";
          const changePercent = Math.abs(priceChange.price_change_percent).toFixed(1);

          addNotification({
            type: "price",
            title: `Preço ${changeType} ${changePercent}%`,
            message: `${product?.title || "Produto"} de ${product?.supplier_name || "Fornecedor"}: R$ ${priceChange.old_price.toFixed(2)} → R$ ${priceChange.new_price.toFixed(2)}`,
            link: "/supplier",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(priceChannel);
    };
  }, [session?.user?.id, addNotification]);

  // Listen for publication errors
  useEffect(() => {
    if (!session?.user?.id) return;

    const publicationChannel = supabase
      .channel("notifications-publications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "publication_history",
          filter: `user_id=eq.${session.user.id}`,
        },
        async (payload) => {
          const publication = payload.new as any;
          
          // Only notify for errors
          if (publication.status !== "error") return;

          // Get product details
          const { data: product } = await supabase
            .from("products")
            .select("title")
            .eq("id", publication.product_id)
            .single();

          addNotification({
            type: "warning",
            title: "Erro de publicação",
            message: `Falha ao publicar "${product?.title || "Produto"}": ${publication.error_details || "Erro desconhecido"}`,
            link: "/products",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(publicationChannel);
    };
  }, [session?.user?.id, addNotification]);

  // Listen for goal alerts
  useEffect(() => {
    if (!session?.user?.id) return;

    const goalChannel = supabase
      .channel("notifications-goals")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "goal_alerts",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const alert = payload.new as any;
          
          addNotification({
            type: "info",
            title: alert.alert_type === "achieved" ? "🎉 Meta atingida!" : "⚠️ Alerta de meta",
            message: alert.message || `Meta: ${alert.current_value}/${alert.target_value}`,
            link: "/reports",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(goalChannel);
    };
  }, [session?.user?.id, addNotification]);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
}
