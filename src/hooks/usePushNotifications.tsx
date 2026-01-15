import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  isEnabled: boolean;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: "unsupported",
    isEnabled: false,
  });

  useEffect(() => {
    const isSupported = "Notification" in window;
    const storedEnabled = localStorage.getItem("push_notifications_enabled") === "true";
    
    setState({
      isSupported,
      permission: isSupported ? Notification.permission : "unsupported",
      isEnabled: isSupported && Notification.permission === "granted" && storedEnabled,
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      toast.error("Notificações push não são suportadas neste navegador");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === "granted";
      
      if (granted) {
        localStorage.setItem("push_notifications_enabled", "true");
        toast.success("Notificações push ativadas!");
      } else if (permission === "denied") {
        toast.error("Permissão para notificações foi negada");
      }

      setState(prev => ({
        ...prev,
        permission,
        isEnabled: granted,
      }));

      return granted;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast.error("Erro ao solicitar permissão para notificações");
      return false;
    }
  }, [state.isSupported]);

  const disableNotifications = useCallback(() => {
    localStorage.setItem("push_notifications_enabled", "false");
    setState(prev => ({
      ...prev,
      isEnabled: false,
    }));
    toast.info("Notificações push desativadas");
  }, []);

  const enableNotifications = useCallback(async () => {
    if (state.permission === "granted") {
      localStorage.setItem("push_notifications_enabled", "true");
      setState(prev => ({
        ...prev,
        isEnabled: true,
      }));
      toast.success("Notificações push ativadas!");
      return true;
    } else {
      return await requestPermission();
    }
  }, [state.permission, requestPermission]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!state.isEnabled || state.permission !== "granted") {
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error("Error sending notification:", error);
      return null;
    }
  }, [state.isEnabled, state.permission]);

  return {
    ...state,
    requestPermission,
    enableNotifications,
    disableNotifications,
    sendNotification,
  };
}
