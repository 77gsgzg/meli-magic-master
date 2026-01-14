import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Clock, Save, Loader2, Play, Pause, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AutoRetrySettings {
  enabled: boolean;
  intervalMinutes: number;
  maxRetries: number;
  retryOlderThanHours: number;
}

interface WebhookAutoRetrySettingsProps {
  userId: string;
  onSettingsChange?: (settings: AutoRetrySettings) => void;
}

const STORAGE_KEY = "webhook_auto_retry_settings";

export function WebhookAutoRetrySettings({ userId, onSettingsChange }: WebhookAutoRetrySettingsProps) {
  const [settings, setSettings] = useState<AutoRetrySettings>({
    enabled: false,
    intervalMinutes: 15,
    maxRetries: 3,
    retryOlderThanHours: 24,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings(parsed);
        onSettingsChange?.(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, [userId, onSettingsChange]);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(settings));
      onSettingsChange?.(settings);
      toast.success("Configurações salvas!", {
        description: settings.enabled 
          ? `Retry automático ativado a cada ${settings.intervalMinutes} minutos`
          : "Retry automático desativado",
      });
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEnabled = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enabled }));
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Agendamento Automático de Retry
        </CardTitle>
        <CardDescription>
          Configure reprocessamento automático de webhooks falhados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            O reprocessamento automático roda localmente no navegador enquanto esta página estiver aberta. 
            Para processamento em segundo plano, considere usar um cron job externo.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Ativar Retry Automático</Label>
            <p className="text-sm text-muted-foreground">
              Reprocessar webhooks falhados automaticamente
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settings.enabled ? (
              <Play className="h-4 w-4 text-success" />
            ) : (
              <Pause className="h-4 w-4 text-muted-foreground" />
            )}
            <Switch
              checked={settings.enabled}
              onCheckedChange={toggleEnabled}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="interval">Intervalo (minutos)</Label>
            <Select
              value={settings.intervalMinutes.toString()}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, intervalMinutes: parseInt(value) }))
              }
              disabled={!settings.enabled}
            >
              <SelectTrigger id="interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 minutos</SelectItem>
                <SelectItem value="10">10 minutos</SelectItem>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxRetries">Máximo de Retries por Log</Label>
            <Select
              value={settings.maxRetries.toString()}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, maxRetries: parseInt(value) }))
              }
              disabled={!settings.enabled}
            >
              <SelectTrigger id="maxRetries">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 retry</SelectItem>
                <SelectItem value="2">2 retries</SelectItem>
                <SelectItem value="3">3 retries</SelectItem>
                <SelectItem value="5">5 retries</SelectItem>
                <SelectItem value="10">10 retries</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="olderThan">Ignorar logs mais antigos que</Label>
            <Select
              value={settings.retryOlderThanHours.toString()}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, retryOlderThanHours: parseInt(value) }))
              }
              disabled={!settings.enabled}
            >
              <SelectTrigger id="olderThan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 horas</SelectItem>
                <SelectItem value="12">12 horas</SelectItem>
                <SelectItem value="24">24 horas</SelectItem>
                <SelectItem value="48">48 horas</SelectItem>
                <SelectItem value="72">72 horas</SelectItem>
                <SelectItem value="168">7 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
