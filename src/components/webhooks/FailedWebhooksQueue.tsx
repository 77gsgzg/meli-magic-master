import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  RefreshCw,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: any;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  created_at: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
}

interface FailedWebhooksQueueProps {
  logs: WebhookLog[];
  webhooks: Webhook[];
}

export function FailedWebhooksQueue({ logs, webhooks }: FailedWebhooksQueueProps) {
  const queryClient = useQueryClient();
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  // Filter only failed logs
  const failedLogs = logs.filter((l) => !l.success && l.event_type !== "test");

  const getWebhookName = (webhookId: string) => {
    return webhooks.find((w) => w.id === webhookId)?.name || "Webhook removido";
  };

  const toggleSelectLog = (logId: string) => {
    setSelectedLogs((prev) =>
      prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLogs.length === failedLogs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(failedLogs.map((l) => l.id));
    }
  };

  const retryWebhook = async (log: WebhookLog) => {
    setRetryingId(log.id);
    try {
      const webhook = webhooks.find((w) => w.id === log.webhook_id);
      if (!webhook) {
        toast.error("Webhook não encontrado");
        return;
      }

      // Re-trigger the webhook with the original payload
      const { data, error } = await supabase.functions.invoke("trigger-webhook", {
        body: {
          event_type: log.event_type,
          user_id: (log.payload as any)?.user_id || "",
          data: (log.payload as any)?.data || log.payload,
        },
      });

      if (error) throw error;

      toast.success("Webhook reenviado!", {
        description: `${data.success || 0} de ${data.total || 1} webhooks processados`,
      });

      queryClient.invalidateQueries({ queryKey: ["webhook-logs"] });
    } catch (error: any) {
      toast.error("Erro ao reenviar webhook", {
        description: error.message,
      });
    } finally {
      setRetryingId(null);
    }
  };

  const retrySelected = async () => {
    if (selectedLogs.length === 0) return;

    setRetryingAll(true);
    let successCount = 0;
    let errorCount = 0;

    for (const logId of selectedLogs) {
      const log = failedLogs.find((l) => l.id === logId);
      if (!log) continue;

      try {
        const webhook = webhooks.find((w) => w.id === log.webhook_id);
        if (!webhook) continue;

        await supabase.functions.invoke("trigger-webhook", {
          body: {
            event_type: log.event_type,
            user_id: (log.payload as any)?.user_id || "",
            data: (log.payload as any)?.data || log.payload,
          },
        });

        successCount++;
      } catch {
        errorCount++;
      }
    }

    toast.success("Processamento concluído", {
      description: `${successCount} sucesso, ${errorCount} erros`,
    });

    setSelectedLogs([]);
    queryClient.invalidateQueries({ queryKey: ["webhook-logs"] });
    setRetryingAll(false);
  };

  if (failedLogs.length === 0) {
    return (
      <Card variant="glass">
        <CardContent className="py-12">
          <div className="text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-4" />
            <p className="font-medium">Nenhum webhook pendente</p>
            <p className="text-sm text-muted-foreground">
              Todos os webhooks foram entregues com sucesso!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Fila de Webhooks Pendentes
            </CardTitle>
            <CardDescription>
              {failedLogs.length} webhook(s) falharam e podem ser reenviados
            </CardDescription>
          </div>
          {selectedLogs.length > 0 && (
            <Button
              onClick={retrySelected}
              disabled={retryingAll}
              className="gap-2"
            >
              {retryingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reenviar Selecionados ({selectedLogs.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedLogs.length === failedLogs.length && failedLogs.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Webhook</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Erro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {failedLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedLogs.includes(log.id)}
                    onCheckedChange={() => toggleSelectLog(log.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {getWebhookName(log.webhook_id)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{log.event_type}</Badge>
                </TableCell>
                <TableCell>
                  {log.response_status ? (
                    <Badge variant="destructive">{log.response_status}</Badge>
                  ) : (
                    <Badge variant="outline">Timeout/Erro</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                </TableCell>
                <TableCell className="max-w-xs">
                  <p className="text-sm text-muted-foreground truncate">
                    {log.response_body?.substring(0, 50) || "Erro desconhecido"}
                  </p>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => retryWebhook(log)}
                    disabled={retryingId === log.id}
                    className="gap-1"
                  >
                    {retryingId === log.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Reenviar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
