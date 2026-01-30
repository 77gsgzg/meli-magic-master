import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Bell, BellRing, Smartphone, Star, Loader2, Save, Package, TrendingDown } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface NotificationSettings {
  price_alerts_enabled: boolean;
  new_product_alerts_enabled: boolean;
  price_threshold: number;
}

export function FavoriteNotificationSettings() {
  const { session } = useAuth();
  const { isSupported, isEnabled, permission, requestPermission, enableNotifications, disableNotifications } =
    usePushNotifications();

  const [settings, setSettings] = useState<NotificationSettings>({
    price_alerts_enabled: true,
    new_product_alerts_enabled: true,
    price_threshold: 5,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [alertsEnabledCount, setAlertsEnabledCount] = useState(0);

  useEffect(() => {
    if (session?.user?.id) {
      loadSettings();
      loadFavoriteStats();
    }
  }, [session?.user?.id]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("user_preferences")
      .select("supplier_price_alert_enabled, supplier_price_threshold, supplier_alert_push_enabled")
      .eq("user_id", session!.user.id)
      .single();

    if (data) {
      setSettings({
        price_alerts_enabled: data.supplier_price_alert_enabled ?? true,
        new_product_alerts_enabled: data.supplier_alert_push_enabled ?? true,
        price_threshold: data.supplier_price_threshold ?? 5,
      });
    }
    setIsLoading(false);
  };

  const loadFavoriteStats = async () => {
    const { data } = await supabase
      .from("discovered_suppliers")
      .select("id, alert_new_products")
      .eq("user_id", session!.user.id)
      .eq("is_favorite", true);

    if (data) {
      setFavoriteCount(data.length);
      setAlertsEnabledCount(data.filter(s => s.alert_new_products).length);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from("user_preferences").upsert({
        user_id: session.user.id,
        supplier_price_alert_enabled: settings.price_alerts_enabled,
        supplier_price_threshold: settings.price_threshold,
        supplier_alert_push_enabled: settings.new_product_alerts_enabled,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      toast.success("Configurações de notificação salvas!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnablePush = async () => {
    if (permission === "denied") {
      toast.error("Permissão bloqueada. Habilite nas configurações do navegador.");
      return;
    }
    await enableNotifications();
  };

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          Notificações de Fornecedores Favoritos
        </CardTitle>
        <CardDescription>
          Configure alertas para mudanças de preço e novos produtos dos seus fornecedores favoritos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 flex items-center gap-3">
            <Star className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{favoriteCount}</p>
              <p className="text-sm text-muted-foreground">Fornecedores Favoritos</p>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{alertsEnabledCount}</p>
              <p className="text-sm text-muted-foreground">Com Alertas Ativos</p>
            </div>
          </div>
        </div>

        {/* Push Notification Permission */}
        <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Notificações Push</p>
                <p className="text-sm text-muted-foreground">
                  Receba alertas mesmo com o navegador fechado
                </p>
              </div>
            </div>
            {isSupported ? (
              isEnabled ? (
                <Button variant="outline" onClick={disableNotifications}>
                  Desativar Push
                </Button>
              ) : (
                <Button onClick={handleEnablePush}>
                  Ativar Push
                </Button>
              )
            ) : (
              <Badge variant="secondary">Não suportado</Badge>
            )}
          </div>
          {isSupported && (
            <Badge variant={isEnabled ? "default" : "secondary"}>
              {isEnabled ? "Push ativo" : permission === "denied" ? "Bloqueado" : "Desativado"}
            </Badge>
          )}
        </div>

        {/* Alert Settings */}
        <div className="space-y-4">
          <h4 className="font-medium">Tipos de Alerta</h4>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Mudanças de Preço</p>
                <p className="text-sm text-muted-foreground">
                  Alertar quando preços subirem ou caírem
                </p>
              </div>
            </div>
            <Switch
              checked={settings.price_alerts_enabled}
              onCheckedChange={checked =>
                setSettings(prev => ({ ...prev, price_alerts_enabled: checked }))
              }
            />
          </div>

          {settings.price_alerts_enabled && (
            <div className="pl-4 space-y-3">
              <Label>Limite mínimo de variação: {settings.price_threshold}%</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[settings.price_threshold]}
                  onValueChange={([value]) =>
                    setSettings(prev => ({ ...prev, price_threshold: value }))
                  }
                  min={1}
                  max={30}
                  step={1}
                  className="flex-1"
                />
                <Badge variant="outline">±{settings.price_threshold}%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Só notificar quando a variação de preço for maior que este limite
              </p>
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">Novos Produtos</p>
                <p className="text-sm text-muted-foreground">
                  Alertar quando fornecedores favoritos tiverem novos produtos
                </p>
              </div>
            </div>
            <Switch
              checked={settings.new_product_alerts_enabled}
              onCheckedChange={checked =>
                setSettings(prev => ({ ...prev, new_product_alerts_enabled: checked }))
              }
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
