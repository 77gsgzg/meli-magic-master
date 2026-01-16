import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export type DailyRevenuePoint = {
  date: string; // yyyy-MM-dd
  revenue: number;
  orders: number;
};

export type TopMetricRow = {
  key: string;
  label: string;
  orders: number;
  revenue: number;
};

export type SalesMetrics = {
  daily: DailyRevenuePoint[];
  totalRevenue: number;
  totalOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  conversionRate: number | null; // orders/views
  avgShipHours: number | null;

  avgOrderValue: number | null;
  topProducts: TopMetricRow[];
  topBuyers: TopMetricRow[];
};

export type SalesRangeOptions =
  | number
  | {
      days?: number;
      from?: Date;
      to?: Date;
    };

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeOptions(options: SalesRangeOptions): { fromISO: string; toISO: string | null; days: number } {
  if (typeof options === "number") {
    const days = options;
    return {
      fromISO: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      toISO: null,
      days,
    };
  }

  const days = options.days ?? 30;
  const from = options.from ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const to = options.to ?? null;

  return {
    fromISO: from.toISOString(),
    toISO: to ? to.toISOString() : null,
    days,
  };
}

export function useSalesMetrics(options: SalesRangeOptions = 30) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { fromISO, toISO, days } = normalizeOptions(options);

  return useQuery({
    queryKey: ["sales-metrics", userId, fromISO, toISO, days],
    enabled: !!userId,
    queryFn: async (): Promise<SalesMetrics> => {
      const [{ data: orders, error: ordersError }, { data: products, error: productsError }] = await Promise.all([
        supabase
          .from("ml_orders")
          .select(
            "date_created,total_amount,status,shipping_status,shipped_at,delivered_at,item_title,ml_item_id,buyer_nickname"
          )
          .eq("user_id", userId!)
          .gte("date_created", fromISO)
          .lte("date_created", toISO ?? new Date().toISOString()),
        supabase.from("products").select("views").eq("user_id", userId!),
      ]);

      if (ordersError) throw ordersError;
      if (productsError) throw productsError;

      const map = new Map<string, { revenue: number; orders: number }>();
      let totalRevenue = 0;

      let shippedOrders = 0;
      let deliveredOrders = 0;
      const shipDurations: number[] = [];

      const byProduct = new Map<string, { label: string; revenue: number; orders: number }>();
      const byBuyer = new Map<string, { label: string; revenue: number; orders: number }>();

      for (const o of orders || []) {
        // Métricas de vendas consideram somente pedidos pagos
        if ((o.status as any) !== "paid") continue;

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

        const productKey = (o.ml_item_id as any as string) || (o.item_title as any as string) || "unknown";
        const productLabel = (o.item_title as any as string) || "Produto";
        const p = byProduct.get(productKey) || { label: productLabel, revenue: 0, orders: 0 };
        p.revenue += amount;
        p.orders += 1;
        p.label = productLabel;
        byProduct.set(productKey, p);

        const buyerKey = (o.buyer_nickname as any as string) || "unknown";
        const b = byBuyer.get(buyerKey) || { label: buyerKey, revenue: 0, orders: 0 };
        b.revenue += amount;
        b.orders += 1;
        byBuyer.set(buyerKey, b);
      }

      const daily = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, revenue: Number(v.revenue.toFixed(2)), orders: v.orders }));

      const totalOrders = orders?.length || 0;

      const totalViews = (products || []).reduce((acc, p) => acc + safeNumber((p as any).views), 0);
      const conversionRate = totalViews > 0 ? totalOrders / totalViews : null;

      const avgShipHours = shipDurations.length
        ? shipDurations.reduce((a, b) => a + b, 0) / shipDurations.length
        : null;

      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : null;

      const topProducts: TopMetricRow[] = Array.from(byProduct.entries())
        .map(([key, v]) => ({ key, label: v.label, orders: v.orders, revenue: Number(v.revenue.toFixed(2)) }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);

      const topBuyers: TopMetricRow[] = Array.from(byBuyer.entries())
        .map(([key, v]) => ({ key, label: v.label, orders: v.orders, revenue: Number(v.revenue.toFixed(2)) }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);

      return {
        daily,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalOrders,
        shippedOrders,
        deliveredOrders,
        conversionRate,
        avgShipHours: avgShipHours ? Number(avgShipHours.toFixed(1)) : null,
        avgOrderValue: avgOrderValue ? Number(avgOrderValue.toFixed(2)) : null,
        topProducts,
        topBuyers,
      };
    },
  });
}
