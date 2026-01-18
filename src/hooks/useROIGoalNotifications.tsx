import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface ROIGoal {
  id: string;
  name: string;
  metric: string;
  target: number;
  current: number;
  achieved: boolean;
}

export function useROIGoalNotifications() {
  const { session } = useAuth();
  const notifiedGoalsRef = useRef<Set<string>>(new Set());
  const permissionRef = useRef<NotificationPermission>("default");

  // Check if push notifications are supported and get permission
  const isSupported = typeof window !== "undefined" && "Notification" in window;

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      permissionRef.current = permission;
      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback(
    (title: string, body: string, icon?: string) => {
      if (!isSupported || permissionRef.current !== "granted") {
        // Fallback to toast
        toast.info(title, { description: body });
        return;
      }

      try {
        new Notification(title, {
          body,
          icon: icon || "/favicon.ico",
          badge: "/favicon.ico",
          tag: "roi-goal",
          requireInteraction: true,
        });
      } catch (error) {
        console.error("Error sending notification:", error);
        toast.info(title, { description: body });
      }
    },
    [isSupported]
  );

  const checkGoalAchievement = useCallback(
    (goal: ROIGoal) => {
      const goalKey = `${goal.id}-${goal.achieved}`;

      // Don't notify if already notified
      if (notifiedGoalsRef.current.has(goalKey)) return;

      if (goal.achieved && goal.current >= goal.target) {
        notifiedGoalsRef.current.add(goalKey);
        sendNotification(
          "🎯 Meta de ROI Atingida!",
          `A meta "${goal.name}" foi alcançada! Valor atual: ${goal.current.toFixed(1)}% (Meta: ${goal.target}%)`
        );
      } else if (!goal.achieved && goal.current < goal.target * 0.8) {
        // Notify if below 80% of target
        const warningKey = `${goal.id}-warning`;
        if (!notifiedGoalsRef.current.has(warningKey)) {
          notifiedGoalsRef.current.add(warningKey);
          sendNotification(
            "⚠️ Alerta de Meta de ROI",
            `A meta "${goal.name}" está abaixo do esperado. Valor atual: ${goal.current.toFixed(1)}% (Meta: ${goal.target}%)`
          );
        }
      }
    },
    [sendNotification]
  );

  const monitorGoals = useCallback(
    async (goals: ROIGoal[]) => {
      if (!session?.user) return;

      // Request permission on first monitoring
      if (permissionRef.current === "default") {
        await requestPermission();
      }

      goals.forEach(checkGoalAchievement);
    },
    [session?.user, requestPermission, checkGoalAchievement]
  );

  // Subscribe to goal_alerts table for real-time notifications
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel("goal-alerts")
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
          const isAchieved = alert.alert_type === "achieved";

          if (isAchieved) {
            sendNotification(
              "🎯 Meta de ROI Atingida!",
              alert.message || `Meta alcançada! Valor: ${alert.current_value.toFixed(1)}%`
            );
          } else {
            sendNotification(
              "⚠️ Meta de ROI Não Atingida",
              alert.message || `Meta não cumprida. Valor atual: ${alert.current_value.toFixed(1)}%`
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, sendNotification]);

  return {
    isSupported,
    requestPermission,
    monitorGoals,
    sendNotification,
  };
}
