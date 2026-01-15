import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileJson,
  Clock,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BackupData {
  version: string;
  exportedAt: string;
  userId: string;
  data: {
    preferences: any;
    webhooks: any[];
    actionMappings: any[];
    securityAlertSettings: any;
  };
}

interface BackupRestoreSectionProps {
  userId: string;
}

export function BackupRestoreSection({ userId }: BackupRestoreSectionProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(
    localStorage.getItem(`last-backup-${userId}`)
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch all user settings
      const [
        preferencesRes,
        webhooksRes,
        actionMappingsRes,
        securitySettingsRes,
      ] = await Promise.all([
        supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("webhooks")
          .select("name, url, events, is_active, secret")
          .eq("user_id", userId),
        supabase
          .from("publication_action_mappings")
          .select("action, operation_type, description")
          .eq("user_id", userId),
        supabase
          .from("security_alert_settings")
          .select("error_threshold, window_minutes")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const backup: BackupData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        userId: userId,
        data: {
          preferences: preferencesRes.data || null,
          webhooks: webhooksRes.data || [],
          actionMappings: actionMappingsRes.data || [],
          securityAlertSettings: securitySettingsRes.data || null,
        },
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-config-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Save last backup time
      const now = new Date().toISOString();
      localStorage.setItem(`last-backup-${userId}`, now);
      setLastBackup(now);

      toast.success("Backup exportado com sucesso!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar backup");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const backup: BackupData = JSON.parse(text);

      // Validate backup structure
      if (!backup.version || !backup.data) {
        throw new Error("Arquivo de backup inválido");
      }

      // Confirm import
      const confirmed = window.confirm(
        `Restaurar configurações do backup de ${format(
          new Date(backup.exportedAt),
          "dd/MM/yyyy 'às' HH:mm",
          { locale: ptBR }
        )}?\n\nIsso substituirá suas configurações atuais.`
      );

      if (!confirmed) {
        setImporting(false);
        return;
      }

      // Restore preferences
      if (backup.data.preferences) {
        const { user_id, created_at, ...prefs } = backup.data.preferences;
        
        const { data: existing } = await supabase
          .from("user_preferences")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("user_preferences")
            .update({ ...prefs, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
        } else {
          await supabase
            .from("user_preferences")
            .insert({ ...prefs, user_id: userId });
        }
      }

      // Restore security alert settings
      if (backup.data.securityAlertSettings) {
        const { user_id, created_at, ...settings } = backup.data.securityAlertSettings;
        
        const { data: existing } = await supabase
          .from("security_alert_settings")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("security_alert_settings")
            .update({ ...settings, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
        } else {
          await supabase
            .from("security_alert_settings")
            .insert({ ...settings, user_id: userId });
        }
      }

      // Restore webhooks (optional - ask user)
      if (backup.data.webhooks?.length > 0) {
        const restoreWebhooks = window.confirm(
          `Deseja também restaurar ${backup.data.webhooks.length} webhook(s)?\n\nWebhooks existentes NÃO serão removidos.`
        );

        if (restoreWebhooks) {
          for (const webhook of backup.data.webhooks) {
            // Check if webhook with same URL already exists
            const { data: existing } = await supabase
              .from("webhooks")
              .select("id")
              .eq("user_id", userId)
              .eq("url", webhook.url)
              .maybeSingle();

            if (!existing) {
              await supabase.from("webhooks").insert({
                ...webhook,
                user_id: userId,
              });
            }
          }
        }
      }

      // Restore action mappings
      if (backup.data.actionMappings?.length > 0) {
        for (const mapping of backup.data.actionMappings) {
          const { data: existing } = await supabase
            .from("publication_action_mappings")
            .select("user_id")
            .eq("user_id", userId)
            .eq("action", mapping.action)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("publication_action_mappings")
              .update({ ...mapping, updated_at: new Date().toISOString() })
              .eq("user_id", userId)
              .eq("action", mapping.action);
          } else {
            await supabase
              .from("publication_action_mappings")
              .insert({ ...mapping, user_id: userId });
          }
        }
      }

      toast.success("Configurações restauradas com sucesso!");
      
      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro ao importar backup", {
        description: error instanceof Error ? error.message : "Arquivo inválido",
      });
    } finally {
      setImporting(false);
      // Reset input
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Card */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Exportar Configurações
          </CardTitle>
          <CardDescription>
            Faça backup de todas as suas preferências, webhooks e configurações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
            <FileJson className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">O que é exportado:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>Preferências de notificação e timezone</li>
                <li>Configurações de webhooks</li>
                <li>Mapeamentos de ações de publicação</li>
                <li>Configurações de alertas de segurança</li>
              </ul>
            </div>
          </div>

          {lastBackup && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Último backup: {format(new Date(lastBackup), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}

          <Button onClick={handleExport} disabled={exporting} className="w-full sm:w-auto">
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exportar Backup
          </Button>
        </CardContent>
      </Card>

      {/* Import Card */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Restaurar Configurações
          </CardTitle>
          <CardDescription>
            Importe configurações de um backup anterior ou de outra conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              A restauração substituirá suas configurações atuais. Recomendamos fazer um backup antes de importar.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="backup-file" className="text-sm text-muted-foreground">
              Selecione o arquivo de backup (.json)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="backup-file"
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={importing}
                className="max-w-sm"
              />
              {importing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/10 p-4">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Migração entre contas</p>
              <p className="text-muted-foreground">
                Para migrar configurações para outra conta:
              </p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-0.5">
                <li>Exporte o backup na conta de origem</li>
                <li>Faça login na conta de destino</li>
                <li>Importe o arquivo de backup</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
