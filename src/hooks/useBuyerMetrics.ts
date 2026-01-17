import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, getHours, startOfWeek } from "date-fns";

export type BuyerType = "new" | "recurring";

export type BuyerSegment = {
  type: BuyerType;
  count: number;
  revenue: number;
  avgOrderValue: number;
  percentage: number;
};

export type HourlyOrderPoint = {
  hour: number; // 0-23
  label: string; // "00h", "01h", etc.
  orders: number;
  revenue: number;
};

export type DelayedOrder = {
  id: string;
  ml_order_id: string;
  buyer_nickname: string;
  buyer_email: string | null;
  buyer_first_name: string | null;
  item_title: string;
  total_amount: number | null;
  date_created: string;
  hoursDelayed: number;
  status: string;
  shipping_status: string | null;
};

export type BuyerMetrics = {
  segments: BuyerSegment[];
  hourlyDistribution: HourlyOrderPoint[];
  delayedOrders: DelayedOrder[];
  recurringBuyersList: { nickname: string; orders: number; revenue: number }[];
};

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type BuyerMetricsOptions = {
  days?: number;
  from?: Date;
  to?: Date;
  delayThresholdHours?: number;
};

export function useBuyerMetrics(options: BuyerMetricsOptions = {}) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  
  const days = options.days ?? 30;
  const fromDate = options.from ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const toDate = options.to ?? new Date();
  const delayThreshold = options.delayThresholdHours ?? 48;

  const fromISO = fromDate.toISOString();
  const toISO = toDate.toISOString();

  return useQuery({
    queryKey: ["buyer-metrics", userId, fromISO, toISO, delayThreshold],
    enabled: !!userId,
    queryFn: async (): Promise<BuyerMetrics> => {
      // Fetch all paid orders
      const { data: orders, error } = await supabase
        .from("ml_orders")
        .select(
          "id,ml_order_id,buyer_nickname,buyer_email,buyer_first_name,item_title,total_amount,date_created,status,shipping_status,shipped_at"
        )
        .eq("user_id", userId!)
        .eq("status", "paid")
        .gte("date_created", fromISO)
        .lte("date_created", toISO);

      if (error) throw error;

      // Fetch historical orders to identify recurring buyers
      const { data: historicalOrders, error: histError } = await supabase
        .from("ml_orders")
        .select("buyer_nickname,date_created")
        .eq("user_id", userId!)
        .eq("status", "paid")
        .lt("date_created", fromISO);

      if (histError) throw histError;

      const historicalBuyers = new Set(
        (historicalOrders || []).map((o) => o.buyer_nickname)
      );

      // Process buyers in current period
      const buyerMap = new Map<string, { orders: number; revenue: number; isRecurring: boolean }>();
      const hourlyMap = new Map<number, { orders: number; revenue: number }>();
      const delayedOrders: DelayedOrder[] = [];

      const now = Date.now();

      for (const o of orders || []) {
        const nickname = o.buyer_nickname || "unknown";
        const amount = safeNumber(o.total_amount);
        const orderDate = new Date(o.date_created);
        const hour = getHours(orderDate);

        // Buyer stats
        const existing = buyerMap.get(nickname) || {
          orders: 0,
          revenue: 0,
          isRecurring: historicalBuyers.has(nickname),
        };
        existing.orders += 1;
        existing.revenue += amount;
        buyerMap.set(nickname, existing);

        // Hourly distribution
        const hourData = hourlyMap.get(hour) || { orders: 0, revenue: 0 };
        hourData.orders += 1;
        hourData.revenue += amount;
        hourlyMap.set(hour, hourData);

        // Delayed orders check (not shipped after threshold)
        if (!o.shipped_at && o.shipping_status !== "shipped" && o.shipping_status !== "delivered") {
          const hoursElapsed = (now - orderDate.getTime()) / (1000 * 60 * 60);
          if (hoursElapsed >= delayThreshold) {
            delayedOrders.push({
              id: o.id,
              ml_order_id: o.ml_order_id,
              buyer_nickname: o.buyer_nickname,
              buyer_email: o.buyer_email,
              buyer_first_name: o.buyer_first_name,
              item_title: o.item_title,
              total_amount: o.total_amount,
              date_created: o.date_created,
              hoursDelayed: Math.round(hoursElapsed),
              status: o.status,
              shipping_status: o.shipping_status,
            });
          }
        }
      }

      // Calculate segments
      let newCount = 0, newRevenue = 0;
      let recurringCount = 0, recurringRevenue = 0;
      const recurringBuyersList: { nickname: string; orders: number; revenue: number }[] = [];

      for (const [nickname, data] of buyerMap.entries()) {
        if (data.isRecurring) {
          recurringCount += data.orders;
          recurringRevenue += data.revenue;
          recurringBuyersList.push({
            nickname,
            orders: data.orders,
            revenue: Number(data.revenue.toFixed(2)),
          });
        } else {
          newCount += data.orders;
          newRevenue += data.revenue;
        }
      }

      const totalOrders = newCount + recurringCount;
      const totalRevenue = newRevenue + recurringRevenue;

      const segments: BuyerSegment[] = [
        {
          type: "new",
          count: newCount,
          revenue: Number(newRevenue.toFixed(2)),
          avgOrderValue: newCount > 0 ? Number((newRevenue / newCount).toFixed(2)) : 0,
          percentage: totalOrders > 0 ? Number(((newCount / totalOrders) * 100).toFixed(1)) : 0,
        },
        {
          type: "recurring",
          count: recurringCount,
          revenue: Number(recurringRevenue.toFixed(2)),
          avgOrderValue: recurringCount > 0 ? Number((recurringRevenue / recurringCount).toFixed(2)) : 0,
          percentage: totalOrders > 0 ? Number(((recurringCount / totalOrders) * 100).toFixed(1)) : 0,
        },
      ];

      // Build hourly distribution
      const hourlyDistribution: HourlyOrderPoint[] = [];
      for (let h = 0; h < 24; h++) {
        const data = hourlyMap.get(h) || { orders: 0, revenue: 0 };
        hourlyDistribution.push({
          hour: h,
          label: `${h.toString().padStart(2, "0")}h`,
          orders: data.orders,
          revenue: Number(data.revenue.toFixed(2)),
        });
      }

      // Sort recurring buyers by revenue
      recurringBuyersList.sort((a, b) => b.revenue - a.revenue);

      // Sort delayed by hours
      delayedOrders.sort((a, b) => b.hoursDelayed - a.hoursDelayed);

      return {
        segments,
        hourlyDistribution,
        delayedOrders,
        recurringBuyersList: recurringBuyersList.slice(0, 20),
      };
    },
  });
}
