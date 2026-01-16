import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type OrderAlertSettings = {
  new_order_push_enabled: boolean;
  shipping_delay_alert_enabled: boolean;
  shipping_delay_hours: number;
};

const DEFAULTS: OrderAlertSettings = {
  new_order_push_enabled: true,
  shipping_delay_alert_enabled: true,
  shipping_delay_hours: 24,
};

export function useOrderAlertSettings() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: ["order-alert-settings", userId],
    enabled: !!userId,
    queryFn: async (): Promise<OrderAlertSettings> => {
      const { data, error } = await supabase
        .from("order_alert_settings")
        .select("new_order_push_enabled,shipping_delay_alert_enabled,shipping_delay_hours")
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return DEFAULTS;

      return {
        new_order_push_enabled: (data as any).new_order_push_enabled ?? DEFAULTS.new_order_push_enabled,
        shipping_delay_alert_enabled: (data as any).shipping_delay_alert_enabled ?? DEFAULTS.shipping_delay_alert_enabled,
        shipping_delay_hours: (data as any).shipping_delay_hours ?? DEFAULTS.shipping_delay_hours,
      };
    },
  });

  const upsert = useMutation({
    mutationFn: async (updates: Partial<OrderAlertSettings>) => {
      if (!userId) throw new Error("Not authenticated");

      // Upsert manually (insert or update) because table is keyed by user_id.
      const { data: existing, error: existsError } = await supabase
        .from("order_alert_settings")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existsError) throw existsError;

      if (existing) {
        const { error } = await supabase
          .from("order_alert_settings")
          .update({ ...updates } as any)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("order_alert_settings")
          .insert({ user_id: userId, ...DEFAULTS, ...updates } as any);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["order-alert-settings", userId] });
    },
  });

  return {
    settings: query.data ?? DEFAULTS,
    isLoading: query.isLoading,
    error: query.error,
    update: (updates: Partial<OrderAlertSettings>) => upsert.mutateAsync(updates),
    updating: upsert.isPending,
  };
}
