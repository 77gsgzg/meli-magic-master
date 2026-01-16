import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export type DailyRevenuePoint = {
  date: string; // yyyy-MM-dd
  revenue: number;
  orders: number;
};

export type SalesMetrics = {
  daily: DailyRevenuePoint[];
  totalRevenue: number;
  totalOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  conversionRate: number | null; // orders/views
  avgShipHours: number | null;
};

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function useSalesMetrics(days: number = 30) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["sales-metrics", session?.user?.id, days],
    enabled: !!session?.user?.id,
    queryFn: async (): Promise<SalesMetrics> => {
      const userId = session!.user.id;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: orders, error: ordersError }, { data: products, error: productsError }] = await Promise.all([
        supabase
          .from("ml_orders")
          .select("date_created,total_amount,status,shipping_status,shipped_at,delivered_at")
          .eq("user_id", userId)
          .gte("date_created", since),
        supabase.from("products").select("views").eq("user_id", userId),
      ]);

      if (ordersError) throw ordersError;
      if (productsError) throw productsError;

      const map = new Map<string, { revenue: number; orders: number }>();
      let totalRevenue = 0;

      let shippedOrders = 0;
      let deliveredOrders = 0;
      const shipDurations: number[] = [];

      for (const o of orders || []) {
        const dayKey = format(new Date(o.date_created), "yyyy-MM-dd");
        const current = map.get(dayKey) || { revenue: 0, orders: 0 };
        const amount = safeNumber(o.total_amount);
        current.revenue += amount;
        current.orders += 1;
        map.set(dayKey, current);
        totalRevenue += amount;

        if (o.shipped_at || o.shipping_status === "shipped") shippedOrders++;
        if (o.delivered_at || o.shipping_status === "delivered") deliveredOrders++;

        if (o.shipped_at) {
          const created = new Date(o.date_created).getTime();
          const shipped = new Date(o.shipped_at).getTime();
          if (Number.isFinite(created) && Number.isFinite(shipped) && shipped >= created) {
            shipDurations.push((shipped - created) / (1000 * 60 * 60));
          }
        }
      }

      const daily = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, revenue: Number(v.revenue.toFixed(2)), orders: v.orders }));

      const totalOrders = orders?.length || 0;

      const totalViews = (products || []).reduce((acc, p) => acc + safeNumber(p.views), 0);
      const conversionRate = totalViews > 0 ? totalOrders / totalViews : null;

      const avgShipHours = shipDurations.length
        ? shipDurations.reduce((a, b) => a + b, 0) / shipDurations.length
        : null;

      return {
        daily,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalOrders,
        shippedOrders,
        deliveredOrders,
        conversionRate,
        avgShipHours: avgShipHours ? Number(avgShipHours.toFixed(1)) : null,
      };
    },
  });
}
