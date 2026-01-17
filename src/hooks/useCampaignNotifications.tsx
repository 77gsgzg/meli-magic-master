import { useEffect, useCallback, useRef } from "react";
import { usePushNotifications } from "./usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface CampaignHistory {
  id: string;
  campaign_type: string;
  recipients_count: number;
  converted_count: number;
  created_at: string;
}

export function useCampaignNotifications() {
  const { sendNotification, isEnabled, isSupported, requestPermission, enableNotifications, disableNotifications } = usePushNotifications();
  const { user } = useAuth();
  const lastNotifiedIdRef = useRef<string | null>(null);
  const isSubscribedRef = useRef(false);

  const notifyCampaignExecuted = useCallback((campaign: CampaignHistory) => {
    const title = campaign.campaign_type === "reactivation" 
      ? "🎯 Campanha de Reativação Executada" 
      : "📦 Alerta de Estoque Enviado";
    
    const body = campaign.campaign_type === "reactivation"
      ? `${campaign.recipients_count} clientes contactados, ${campaign.converted_count} conversões`
      : `${campaign.recipients_count} alertas de estoque crítico enviados`;

    sendNotification(title, {
      body,
      tag: `campaign-${campaign.id}`,
      requireInteraction: false,
      silent: false,
    });

    // Also show toast for in-app notification
    toast.success(title, {
      description: body,
      duration: 5000,
    });
  }, [sendNotification]);

  useEffect(() => {
    if (!user?.id || !isEnabled || isSubscribedRef.current) return;

    console.log("[CampaignNotifications] Setting up realtime subscription");
    isSubscribedRef.current = true;

    const channel = supabase
      .channel("campaign-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "campaign_history",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("[CampaignNotifications] New campaign detected:", payload);
          const campaign = payload.new as CampaignHistory;
          
          // Avoid duplicate notifications
          if (lastNotifiedIdRef.current === campaign.id) return;
          lastNotifiedIdRef.current = campaign.id;
          
          notifyCampaignExecuted(campaign);
        }
      )
      .subscribe((status) => {
        console.log("[CampaignNotifications] Subscription status:", status);
      });

    return () => {
      console.log("[CampaignNotifications] Cleaning up subscription");
      isSubscribedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, isEnabled, notifyCampaignExecuted]);

  return {
    isEnabled,
    isSupported,
    requestPermission,
    enableNotifications,
    disableNotifications,
    notifyCampaignExecuted,
  };
}
