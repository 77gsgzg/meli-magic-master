import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getDay, getHours, subDays, format, differenceInDays } from "date-fns";

export type HeatmapCell = {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  dayLabel: string;
  hour: number; // 0-23
  orders: number;
  revenue: number;
};

export type LoyaltyBuyer = {
  nickname: string;
  email: string | null;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  firstOrderDate: string;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  frequency: number; // orders per month
  loyaltyScore: number; // 0-100
  tier: "bronze" | "silver" | "gold" | "platinum";
};

export type ProductDemand = {
  mlItemId: string;
  title: string;
  totalSold: number;
  avgDaily: number;
  lastSaleDate: string | null;
  trend: "up" | "down" | "stable";
  daysOfStock: number | null; // estimated days based on available_quantity
  availableQuantity: number | null;
  suggestedRestock: number;
};

export type DemandMetrics = {
  heatmap: HeatmapCell[];
  loyaltyBuyers: LoyaltyBuyer[];
  productDemand: ProductDemand[];
  peakHour: number;
  peakDay: number;
  avgLoyaltyScore: number;
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function calculateLoyaltyScore(
  totalOrders: number,
  totalRevenue: number,
  frequency: number,
  daysSinceLastOrder: number
): number {
  // Frequency score (0-30): more orders = higher
  const freqScore = Math.min(frequency * 10, 30);
  
  // Volume score (0-30): higher revenue = higher
  const volumeScore = Math.min(totalRevenue / 500, 30);
  
  // Recency score (0-20): more recent = higher
  const recencyScore = Math.max(0, 20 - daysSinceLastOrder / 3);
  
  // Order count score (0-20)
  const countScore = Math.min(totalOrders * 4, 20);
  
  return Math.round(freqScore + volumeScore + recencyScore + countScore);
}

function getLoyaltyTier(score: number): "bronze" | "silver" | "gold" | "platinum" {
  if (score >= 80) return "platinum";
  if (score >= 60) return "gold";
  if (score >= 40) return "silver";
  return "bronze";
}

export function useDemandMetrics(days: number = 90) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["demand-metrics", userId, days],
    enabled: !!userId,
    queryFn: async (): Promise<DemandMetrics> => {
      const fromDate = subDays(new Date(), days);
      
      const [{ data: orders, error: ordersError }, { data: products, error: productsError }] = await Promise.all([
        supabase
          .from("ml_orders")
          .select("ml_item_id,item_title,buyer_nickname,buyer_email,total_amount,date_created,item_quantity")
          .eq("user_id", userId!)
          .eq("status", "paid")
          .gte("date_created", fromDate.toISOString()),
        supabase
          .from("products")
          .select("ml_item_id,title,available_quantity,sales")
          .eq("user_id", userId!),
      ]);

      if (ordersError) throw ordersError;
      if (productsError) throw productsError;

      // Build heatmap
      const heatmapMap = new Map<string, { orders: number; revenue: number }>();
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          heatmapMap.set(`${d}-${h}`, { orders: 0, revenue: 0 });
        }
      }

      // Build buyer stats
      const buyerMap = new Map<string, {
        email: string | null;
        orders: number;
        revenue: number;
        firstOrder: Date;
        lastOrder: Date;
      }>();

      // Build product demand
      const productMap = new Map<string, {
        title: string;
        totalSold: number;
        revenue: number;
        dates: Date[];
      }>();

      for (const o of orders || []) {
        const orderDate = new Date(o.date_created);
        const dow = getDay(orderDate);
        const hour = getHours(orderDate);
        const amount = Number(o.total_amount) || 0;
        const qty = o.item_quantity || 1;

        // Heatmap
        const key = `${dow}-${hour}`;
        const cell = heatmapMap.get(key)!;
        cell.orders += 1;
        cell.revenue += amount;

        // Buyer
        const nickname = o.buyer_nickname || "unknown";
        const buyer = buyerMap.get(nickname) || {
          email: o.buyer_email,
          orders: 0,
          revenue: 0,
          firstOrder: orderDate,
          lastOrder: orderDate,
        };
        buyer.orders += 1;
        buyer.revenue += amount;
        if (orderDate < buyer.firstOrder) buyer.firstOrder = orderDate;
        if (orderDate > buyer.lastOrder) buyer.lastOrder = orderDate;
        if (!buyer.email && o.buyer_email) buyer.email = o.buyer_email;
        buyerMap.set(nickname, buyer);

        // Product demand
        const mlItemId = o.ml_item_id || "unknown";
        const prod = productMap.get(mlItemId) || {
          title: o.item_title || "Produto",
          totalSold: 0,
          revenue: 0,
          dates: [],
        };
        prod.totalSold += qty;
        prod.revenue += amount;
        prod.dates.push(orderDate);
        productMap.set(mlItemId, prod);
      }

      // Convert heatmap
      const heatmap: HeatmapCell[] = [];
      let maxOrders = 0;
      let peakHour = 0;
      let peakDay = 0;

      for (const [key, data] of heatmapMap.entries()) {
        const [d, h] = key.split("-").map(Number);
        heatmap.push({
          dayOfWeek: d,
          dayLabel: DAY_LABELS[d],
          hour: h,
          orders: data.orders,
          revenue: Number(data.revenue.toFixed(2)),
        });
        if (data.orders > maxOrders) {
          maxOrders = data.orders;
          peakHour = h;
          peakDay = d;
        }
      }

      // Convert loyalty buyers
      const now = new Date();
      const loyaltyBuyers: LoyaltyBuyer[] = [];
      
      for (const [nickname, data] of buyerMap.entries()) {
        if (data.orders < 2) continue; // Only recurring buyers
        
        const daysSinceFirst = differenceInDays(now, data.firstOrder);
        const daysSinceLast = differenceInDays(now, data.lastOrder);
        const monthsActive = Math.max(1, daysSinceFirst / 30);
        const frequency = data.orders / monthsActive;
        const avgOrderValue = data.revenue / data.orders;
        const loyaltyScore = calculateLoyaltyScore(data.orders, data.revenue, frequency, daysSinceLast);

        loyaltyBuyers.push({
          nickname,
          email: data.email,
          totalOrders: data.orders,
          totalRevenue: Number(data.revenue.toFixed(2)),
          avgOrderValue: Number(avgOrderValue.toFixed(2)),
          firstOrderDate: format(data.firstOrder, "yyyy-MM-dd"),
          lastOrderDate: format(data.lastOrder, "yyyy-MM-dd"),
          daysSinceLastOrder: daysSinceLast,
          frequency: Number(frequency.toFixed(2)),
          loyaltyScore,
          tier: getLoyaltyTier(loyaltyScore),
        });
      }

      loyaltyBuyers.sort((a, b) => b.loyaltyScore - a.loyaltyScore);

      // Convert product demand
      const productDemand: ProductDemand[] = [];
      const productLookup = new Map((products || []).map((p) => [p.ml_item_id, p]));

      for (const [mlItemId, data] of productMap.entries()) {
        const avgDaily = data.totalSold / days;
        const lastSaleDate = data.dates.length > 0 
          ? format(data.dates.sort((a, b) => b.getTime() - a.getTime())[0], "yyyy-MM-dd")
          : null;

        // Check trend (compare first half vs second half)
        const midPoint = subDays(now, days / 2);
        const firstHalf = data.dates.filter((d) => d < midPoint).length;
        const secondHalf = data.dates.filter((d) => d >= midPoint).length;
        let trend: "up" | "down" | "stable" = "stable";
        if (secondHalf > firstHalf * 1.2) trend = "up";
        else if (secondHalf < firstHalf * 0.8) trend = "down";

        // Get stock info
        const productInfo = productLookup.get(mlItemId);
        const availableQty = productInfo?.available_quantity ?? null;
        const daysOfStock = availableQty !== null && avgDaily > 0 
          ? Math.round(availableQty / avgDaily)
          : null;

        // Suggest restock: aim for 30 days of stock
        const targetStock = Math.ceil(avgDaily * 30);
        const suggestedRestock = availableQty !== null 
          ? Math.max(0, targetStock - availableQty)
          : targetStock;

        productDemand.push({
          mlItemId,
          title: productInfo?.title || data.title,
          totalSold: data.totalSold,
          avgDaily: Number(avgDaily.toFixed(2)),
          lastSaleDate,
          trend,
          daysOfStock,
          availableQuantity: availableQty,
          suggestedRestock,
        });
      }

      productDemand.sort((a, b) => b.avgDaily - a.avgDaily);

      const avgLoyaltyScore = loyaltyBuyers.length > 0
        ? Math.round(loyaltyBuyers.reduce((sum, b) => sum + b.loyaltyScore, 0) / loyaltyBuyers.length)
        : 0;

      return {
        heatmap,
        loyaltyBuyers: loyaltyBuyers.slice(0, 50),
        productDemand: productDemand.slice(0, 30),
        peakHour,
        peakDay,
        avgLoyaltyScore,
      };
    },
  });
}
