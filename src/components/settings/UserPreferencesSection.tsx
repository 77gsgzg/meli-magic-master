import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Globe, Loader2, Smartphone, ShoppingBag, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOrderAlertSettings } from "@/hooks/useOrderAlertSettings";

interface UserPreferences {
  timezone: string;
  notify_publish_success: boolean;
  notify_publish_error: boolean;
  notify_token_refresh: boolean;
  notify_import_success: boolean;
  notify_import_error: boolean;
  notify_webhook_failure: boolean;
  swipe_haptic_enabled: boolean;
  swipe_sound_enabled: boolean;
}

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Recife", label: "Recife (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Cuiaba", label: "Cuiabá (GMT-4)" },
  { value: "America/Porto_Velho", label: "Porto Velho (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "America/Santiago", label: "Santiago (GMT-4)" },
  { value: "America/Lima", label: "Lima (GMT-5)" },
  { value: "America/Bogota", label: "Bogotá (GMT-5)" },
  { value: "America/Mexico_City", label: "México (GMT-6)" },
  { value: "America/New_York", label: "New York (GMT-5)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
  { value: "Europe/London", label: "Londres (GMT+0)" },
  { value: "Europe/Madrid", label: "Madrid (GMT+1)" },
  { value: "Europe/Paris", label: "Paris (GMT+1)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0)" },
  { value: "UTC", label: "UTC (GMT+0)" },
];

const NOTIFICATION_SETTINGS = [
  {
    key: "notify_publish_success" as const,
    label: "Publicações bem-sucedidas",
    description: "Notificar quando um produto for publicado com sucesso",
  },
  {
    key: "notify_publish_error" as const,
    label: "Erros de publicação",
    description: "Alertar sobre falhas na publicação de produtos",
  },
  {
    key: "notify_import_success" as const,
    label: "Importações bem-sucedidas",
    description: "Notificar quando um produto for importado",
  },
  {
    key: "notify_import_error" as const,
    label: "Erros de importação",
    description: "Alertar sobre falhas na importação",
  },
  {
    key: "notify_token_refresh" as const,
    label: "Renovação de token",
    description: "Avisar quando o token OAuth for renovado",
  },
  {
    key: "notify_webhook_failure" as const,
    label: "Falhas de webhook",
    description: "Alertar quando webhooks falharem",
  },
];

interface UserPreferencesSectionProps {
  userId: string;
}

export function UserPreferencesSection({ userId }: UserPreferencesSectionProps) {
  const queryClient = useQueryClient();
  const orderAlerts = useOrderAlertSettings();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["user-preferences", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      // Return defaults if no preferences exist
      if (!data) {
        return {
          timezone: "America/Sao_Paulo",
          notify_publish_success: true,
          notify_publish_error: true,
          notify_token_refresh: false,
          notify_import_success: true,
          notify_import_error: true,
          notify_webhook_failure: true,
          swipe_haptic_enabled: true,
          swipe_sound_enabled: false,
        } as UserPreferences;
      }

      return {
        timezone: (data as any).timezone || "America/Sao_Paulo",
        notify_publish_success: (data as any).notify_publish_success ?? true,
        notify_publish_error: (data as any).notify_publish_error ?? true,
        notify_token_refresh: (data as any).notify_token_refresh ?? false,
        notify_import_success: (data as any).notify_import_success ?? true,
        notify_import_error: (data as any).notify_import_error ?? true,
        notify_webhook_failure: (data as any).notify_webhook_failure ?? true,
        swipe_haptic_enabled: (data as any).swipe_haptic_enabled ?? true,
        swipe_sound_enabled: (data as any).swipe_sound_enabled ?? false,
      } as UserPreferences;
    },
    enabled: !!userId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<UserPreferences>) => {
      // First check if record exists
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_preferences")
          .update({ ...updates, updated_at: new Date().toISOString() } as any)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_preferences")
          .insert({ user_id: userId, ...updates } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-preferences", userId] });
      toast.success("Preferências salvas!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar preferências", { description: error.message });
    },
  });

  const handleToggle = (key: keyof UserPreferences, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const handleTimezoneChange = (timezone: string) => {
    updateMutation.mutate({ timezone });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timezone */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Fuso Horário
          </CardTitle>
          <CardDescription>
            Defina o fuso horário para exibição de datas e horários
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Label className="text-sm text-muted-foreground mb-2 block">
              Timezone
            </Label>
            <Select
              value={preferences?.timezone || "America/Sao_Paulo"}
              onValueChange={handleTimezoneChange}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o fuso horário" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Usado para exibir datas e horários consistentes em todo o sistema
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notificações
          </CardTitle>
          <CardDescription>
            Configure quais notificações deseja receber no sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {NOTIFICATION_SETTINGS.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">{setting.label}</Label>
                <p className="text-sm text-muted-foreground">
                  {setting.description}
                </p>
              </div>
              <Switch
                checked={preferences?.[setting.key] ?? true}
                onCheckedChange={(checked) => handleToggle(setting.key, checked)}
                disabled={updateMutation.isPending}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Orders Alerts */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Alertas de Pedidos
          </CardTitle>
          <CardDescription>
            Alertas baseados somente em pedidos reais sincronizados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Push para novo pedido</Label>
              <p className="text-sm text-muted-foreground">
                Notifica no navegador quando um novo pedido (pago) entrar.
              </p>
            </div>
            <Switch
              checked={orderAlerts.settings.new_order_push_enabled}
              onCheckedChange={(v) => orderAlerts.update({ new_order_push_enabled: v })}
              disabled={orderAlerts.updating}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Atraso no envio</Label>
              <p className="text-sm text-muted-foreground">
                Registra eventos quando pedidos pagos ficam sem envio por X horas.
              </p>
            </div>
            <Switch
              checked={orderAlerts.settings.shipping_delay_alert_enabled}
              onCheckedChange={(v) => orderAlerts.update({ shipping_delay_alert_enabled: v })}
              disabled={orderAlerts.updating}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm">Limite (horas)</Label>
            </div>
            <div className="flex items-center gap-4">
              <Slider
                value={[orderAlerts.settings.shipping_delay_hours]}
                min={1}
                max={168}
                step={1}
                onValueChange={(v) => orderAlerts.update({ shipping_delay_hours: v[0] })}
                disabled={orderAlerts.updating || !orderAlerts.settings.shipping_delay_alert_enabled}
                className="flex-1"
              />
              <span className="text-sm font-medium w-16 text-right">
                {orderAlerts.settings.shipping_delay_hours}h
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Os alertas são registrados no histórico e podem ser filtrados no Monitor de Pedidos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Swipe Feedback */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Feedback de Swipe (Mobile)
          </CardTitle>
          <CardDescription>
            Configure o feedback ao navegar entre abas com gestos de swipe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Vibração (Haptic)</Label>
              <p className="text-sm text-muted-foreground">
                Vibração sutil ao completar swipe entre abas
              </p>
            </div>
            <Switch
              checked={preferences?.swipe_haptic_enabled ?? true}
              onCheckedChange={(checked) => handleToggle("swipe_haptic_enabled" as keyof UserPreferences, checked)}
              disabled={updateMutation.isPending}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Som</Label>
              <p className="text-sm text-muted-foreground">
                Som sutil de "clique" ao completar swipe entre abas
              </p>
            </div>
            <Switch
              checked={preferences?.swipe_sound_enabled ?? false}
              onCheckedChange={(checked) => handleToggle("swipe_sound_enabled" as keyof UserPreferences, checked)}
              disabled={updateMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
