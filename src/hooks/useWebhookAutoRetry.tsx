import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface AutoRetrySettings {
  enabled: boolean;
  intervalMinutes: number;
  maxRetries: number;
  retryOlderThanHours: number;
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: any;
  success: boolean;
  created_at: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
}

// Track retry counts in memory
const retryCountMap = new Map<string, number>();

export function useWebhookAutoRetry(
  settings: AutoRetrySettings | null,
  logs: WebhookLog[],
  webhooks: Webhook[],
  userId: string | undefined
) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);

  const processFailedWebhooks = useCallback(async () => {
    if (!settings?.enabled || isProcessingRef.current || !userId) return;
    
    isProcessingRef.current = true;

    try {
      // Get failed logs that are within the time window
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - settings.retryOlderThanHours);

      const failedLogs = logs.filter((log) => {
        if (log.success || log.event_type === "test") return false;
        
        const logTime = new Date(log.created_at);
        if (logTime < cutoffTime) return false;

        // Check if webhook is still active
        const webhook = webhooks.find((w) => w.id === log.webhook_id);
        if (!webhook || !webhook.is_active) return false;

        // Check retry count
        const currentRetries = retryCountMap.get(log.id) || 0;
        if (currentRetries >= settings.maxRetries) return false;

        return true;
      });

      if (failedLogs.length === 0) {
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const log of failedLogs) {
        try {
          await supabase.functions.invoke("trigger-webhook", {
            body: {
              event_type: log.event_type,
              user_id: (log.payload as any)?.user_id || userId,
              data: (log.payload as any)?.data || log.payload,
            },
          });

          successCount++;
          // Reset retry count on success
          retryCountMap.delete(log.id);
        } catch {
          errorCount++;
          // Increment retry count
          const currentRetries = retryCountMap.get(log.id) || 0;
          retryCountMap.set(log.id, currentRetries + 1);
        }

        // Add small delay between requests to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (successCount > 0 || errorCount > 0) {
        toast.info("Auto-retry concluído", {
          description: `${successCount} sucesso, ${errorCount} falhas de ${failedLogs.length} webhooks`,
        });
        queryClient.invalidateQueries({ queryKey: ["webhook-logs"] });
      }
    } catch (error) {
      console.error("Error in auto-retry:", error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [settings, logs, webhooks, userId, queryClient]);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Set up new interval if enabled
    if (settings?.enabled && settings.intervalMinutes > 0) {
      const intervalMs = settings.intervalMinutes * 60 * 1000;
      
      // Run immediately on enable
      processFailedWebhooks();
      
      intervalRef.current = setInterval(processFailedWebhooks, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [settings?.enabled, settings?.intervalMinutes, processFailedWebhooks]);

  return {
    isProcessing: isProcessingRef.current,
    processNow: processFailedWebhooks,
  };
}
