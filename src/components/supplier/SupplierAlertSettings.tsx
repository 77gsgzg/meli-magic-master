import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Smartphone, AlertTriangle, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AlertSettings {
  supplier_price_alert_enabled: boolean;
  supplier_price_threshold: number;
  supplier_alert_email_enabled: boolean;
  supplier_alert_push_enabled: boolean;
}

export function SupplierAlertSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AlertSettings>({
    supplier_price_alert_enabled: true,
    supplier_price_threshold: 10,
    supplier_alert_email_enabled: true,
    supplier_alert_push_enabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("supplier_price_alert_enabled, supplier_price_threshold, supplier_alert_email_enabled, supplier_alert_push_enabled")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setSettings({
          supplier_price_alert_enabled: data.supplier_price_alert_enabled ?? true,
          supplier_price_threshold: data.supplier_price_threshold ?? 10,
          supplier_alert_email_enabled: data.supplier_alert_email_enabled ?? true,
          supplier_alert_push_enabled: data.supplier_alert_push_enabled ?? true,
        });
      }
      setIsLoading(false);
    };

    fetchSettings();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Configurações de Alertas de Preço
        </CardTitle>
        <CardDescription>
          Configure quando e como receber alertas sobre mudanças de preço do fornecedor
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas de Preço Ativados
            </Label>
            <p className="text-sm text-muted-foreground">
              Receba notificações quando os preços do fornecedor mudarem
            </p>
          </div>
          <Switch
            checked={settings.supplier_price_alert_enabled}
            onCheckedChange={(checked) => 
              setSettings(prev => ({ ...prev, supplier_price_alert_enabled: checked }))
            }
          />
        </div>

        {settings.supplier_price_alert_enabled && (
          <>
            {/* Threshold Configuration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-medium">
                  Limite de Variação de Preço
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receba alertas quando a variação de preço exceder este valor
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Slider
                    value={[settings.supplier_price_threshold]}
                    onValueChange={([value]) => 
                      setSettings(prev => ({ ...prev, supplier_price_threshold: value }))
                    }
                    min={1}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2 min-w-[100px]">
                  <Input
                    type="number"
                    value={settings.supplier_price_threshold}
                    onChange={(e) => 
                      setSettings(prev => ({ 
                        ...prev, 
                        supplier_price_threshold: Math.min(50, Math.max(1, Number(e.target.value))) 
                      }))
                    }
                    className="w-16 text-center"
                    min={1}
                    max={50}
                  />
                  <span className="text-sm font-medium">%</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Alertar quando: ±{settings.supplier_price_threshold}% ou mais
                </Badge>
              </div>
            </div>

            {/* Notification Methods */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Métodos de Notificação</Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">
                        Receba um email detalhado com as mudanças
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.supplier_alert_email_enabled}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, supplier_alert_email_enabled: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Notificação Push</p>
                      <p className="text-sm text-muted-foreground">
                        Receba notificações instantâneas no navegador
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.supplier_alert_push_enabled}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, supplier_alert_push_enabled: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          </>
        )}

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
