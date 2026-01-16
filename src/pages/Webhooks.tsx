import { useState, useCallback, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Loader2,
  Webhook,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  History,
  Globe,
  Send,
  BarChart3,
  AlertCircle,
  Settings,
  Download,
  FileJson,
  FileSpreadsheet,
  Clock,
  Play,
  Server,
} from "lucide-react";
import { useRequireAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeTabs } from "@/hooks/useSwipeTabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import { WebhookMetrics } from "@/components/webhooks/WebhookMetrics";
import { FailedWebhooksQueue } from "@/components/webhooks/FailedWebhooksQueue";
import { WebhookAutoRetrySettings } from "@/components/webhooks/WebhookAutoRetrySettings";
import { useWebhookAutoRetry } from "@/hooks/useWebhookAutoRetry";
import { WebhookLogsFilter, WebhookLogsFilters } from "@/components/webhooks/WebhookLogsFilter";
import { WebhookLogsPagination } from "@/components/webhooks/WebhookLogsPagination";
import { SwipeIndicator } from "@/components/ui/SwipeIndicator";
import { 
  exportWebhookLogsToCSV, 
  exportWebhookLogsToJSON, 
  exportFailedWebhooksToCSV 
} from "@/utils/exportWebhookLogs";

const WEBHOOK_EVENTS = [
  { id: "publish_success", key: "webhooks.event.publish_success" },
  { id: "publish_error", key: "webhooks.event.publish_error" },
  { id: "batch_import_complete", key: "webhooks.event.batch_import_complete" },
  { id: "import_success", key: "webhooks.event.import_success" },
  { id: "import_error", key: "webhooks.event.import_error" },
  { id: "token_refresh", key: "webhooks.event.token_refresh" },
  { id: "token_error", key: "webhooks.event.token_error" },
];

interface WebhookForm {
  name: string;
  url: string;
  secret: string;
  events: string[];
}

export default function Webhooks() {
  const { user, loading: authLoading } = useRequireAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookForm>({
    name: "",
    url: "",
    secret: "",
    events: [],
  });
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("config");
  const [autoRetrySettings, setAutoRetrySettings] = useState<{
    enabled: boolean;
    intervalMinutes: number;
    maxRetries: number;
    retryOlderThanHours: number;
  } | null>(null);
  const [isRunningCronJob, setIsRunningCronJob] = useState(false);
  const [logsFilters, setLogsFilters] = useState<WebhookLogsFilters>({
    search: "",
    eventType: "",
    status: "",
    dateFrom: undefined,
    dateTo: undefined,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhooks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("webhooks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: webhookLogs } = useQuery({
    queryKey: ["webhook-logs", user?.id],
    queryFn: async () => {
      if (!user || !webhooks?.length) return [];
      const webhookIds = webhooks.map((w) => w.id);
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("*")
        .in("webhook_id", webhookIds)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!webhooks?.length,
  });

  const createMutation = useMutation({
    mutationFn: async (data: WebhookForm) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("webhooks").insert({
        user_id: user.id,
        name: data.name,
        url: data.url,
        secret: data.secret || null,
        events: data.events,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setIsDialogOpen(false);
      resetForm();
      toast.success(t("common.success"), {
        description: "Webhook criado com sucesso!",
      });
    },
    onError: (error) => {
      toast.error(t("common.error"), {
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WebhookForm & { is_active: boolean }> }) => {
      const { error } = await supabase
        .from("webhooks")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setIsDialogOpen(false);
      setEditingWebhook(null);
      resetForm();
      toast.success(t("common.success"), {
        description: "Webhook atualizado!",
      });
    },
    onError: (error) => {
      toast.error(t("common.error"), {
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success(t("common.success"), {
        description: "Webhook excluído!",
      });
    },
    onError: (error) => {
      toast.error(t("common.error"), {
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setForm({ name: "", url: "", secret: "", events: [] });
    setEditingWebhook(null);
  };

  const testWebhook = async (webhookId: string) => {
    setTestingWebhookId(webhookId);
    try {
      const { data, error } = await supabase.functions.invoke("trigger-webhook", {
        body: { webhook_id: webhookId, test: true },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Teste enviado!", {
          description: `Status: ${data.status} - ${data.message}`,
        });
      } else {
        toast.error("Teste falhou", {
          description: data.message || "Erro ao enviar teste",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["webhook-logs"] });
    } catch (error: any) {
      toast.error(t("common.error"), {
        description: error.message || "Erro ao testar webhook",
      });
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.url || form.events.length === 0) {
      toast.error(t("common.error"), {
        description: "Preencha todos os campos obrigatórios",
      });
      return;
    }

    if (editingWebhook) {
      updateMutation.mutate({ id: editingWebhook, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (webhook: typeof webhooks[0]) => {
    setEditingWebhook(webhook.id);
    setForm({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || "",
      events: webhook.events || [],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t("webhooks.confirmDelete"))) {
      deleteMutation.mutate(id);
    }
  };

  const toggleEvent = (eventId: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  // Calculate pending count for tab badge
  const pendingCount = webhookLogs?.filter((l) => !l.success && l.event_type !== "test").length || 0;

  // Get unique event types for filter
  const eventTypes = useMemo(() => {
    if (!webhookLogs) return [];
    return [...new Set(webhookLogs.map((log) => log.event_type))];
  }, [webhookLogs]);

  // Apply filters to logs
  const filteredLogs = useMemo(() => {
    if (!webhookLogs) return [];
    
    return webhookLogs.filter((log) => {
      // Search filter
      if (logsFilters.search) {
        const searchLower = logsFilters.search.toLowerCase();
        const payloadString = JSON.stringify(log.payload || {}).toLowerCase();
        const eventMatch = log.event_type.toLowerCase().includes(searchLower);
        const payloadMatch = payloadString.includes(searchLower);
        const responseMatch = log.response_body?.toLowerCase().includes(searchLower);
        if (!eventMatch && !payloadMatch && !responseMatch) return false;
      }

      // Event type filter
      if (logsFilters.eventType && log.event_type !== logsFilters.eventType) {
        return false;
      }

      // Status filter
      if (logsFilters.status) {
        if (logsFilters.status === "success" && !log.success) return false;
        if (logsFilters.status === "failed" && log.success) return false;
      }

      // Date from filter
      if (logsFilters.dateFrom) {
        const logDate = new Date(log.created_at);
        if (logDate < startOfDay(logsFilters.dateFrom)) return false;
      }

      // Date to filter
      if (logsFilters.dateTo) {
        const logDate = new Date(log.created_at);
        if (logDate > endOfDay(logsFilters.dateTo)) return false;
      }

      return true;
    });
  }, [webhookLogs, logsFilters]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIndex, startIndex + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [logsFilters]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Auto-retry settings handler
  const handleAutoRetrySettingsChange = useCallback((settings: typeof autoRetrySettings) => {
    setAutoRetrySettings(settings);
  }, []);

  // Hook for auto-retry functionality
  useWebhookAutoRetry(
    autoRetrySettings,
    webhookLogs || [],
    webhooks || [],
    user?.id
  );

  // Manual cron job trigger
  const runCronJobManually = async () => {
    setIsRunningCronJob(true);
    try {
      const { data, error } = await supabase.functions.invoke("retry-webhooks", {
        body: {
          maxRetries: autoRetrySettings?.maxRetries || 3,
          retryOlderThanHours: autoRetrySettings?.retryOlderThanHours || 24,
        },
      });

      if (error) throw error;

      toast.success("Job executado!", {
        description: `Processados: ${data.processed}, Sucesso: ${data.success}, Falhas: ${data.failed}`,
      });

      queryClient.invalidateQueries({ queryKey: ["webhook-logs"] });
    } catch (error: any) {
      toast.error("Erro ao executar job", { description: error.message });
    } finally {
      setIsRunningCronJob(false);
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    if (!webhookLogs || !webhooks) return;
    exportWebhookLogsToCSV(webhookLogs, webhooks);
    toast.success("Exportado!", { description: "Logs exportados para CSV" });
  };

  const handleExportJSON = () => {
    if (!webhookLogs || !webhooks) return;
    exportWebhookLogsToJSON(webhookLogs, webhooks);
    toast.success("Exportado!", { description: "Logs exportados para JSON" });
  };

  const handleExportFailedCSV = () => {
    if (!webhookLogs || !webhooks) return;
    exportFailedWebhooksToCSV(webhookLogs, webhooks);
    toast.success("Exportado!", { description: "Falhas exportadas para CSV" });
  };

  const swipeHandlers = useSwipeTabs({
    tabs: ["config", "metrics", "queue", "schedule", "logs"] as const,
    value: activeTab as "config" | "metrics" | "queue" | "schedule" | "logs",
    onValueChange: (v) => setActiveTab(v),
    enabled: isMobile,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout title={t("webhooks.title")} subtitle={t("webhooks.subtitle")}>
      <div className="space-y-4 md:space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} {...swipeHandlers}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <TabsList className="w-full md:w-auto flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="config" className="gap-1 md:gap-2 text-xs md:text-sm flex-1 md:flex-none">
                <Settings className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Config</span>
              </TabsTrigger>
              <TabsTrigger value="metrics" className="gap-1 md:gap-2 text-xs md:text-sm flex-1 md:flex-none">
                <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Monitor</span>
              </TabsTrigger>
              <TabsTrigger value="queue" className="gap-1 md:gap-2 text-xs md:text-sm flex-1 md:flex-none">
                <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-1 md:gap-2 text-xs md:text-sm flex-1 md:flex-none">
                <Clock className="h-3 w-3 md:h-4 md:w-4" />
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1 md:gap-2 text-xs md:text-sm flex-1 md:flex-none">
                <History className="h-3 w-3 md:h-4 md:w-4" />
              </TabsTrigger>
            </TabsList>
            {isMobile && (
              <SwipeIndicator
                currentIndex={["config", "metrics", "queue", "schedule", "logs"].indexOf(activeTab)}
                totalTabs={5}
                tabLabels={["Config", "Monitor", "Fila", "Agenda", "Logs"]}
              />
            )}

            {activeTab === "config" && (
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full md:w-auto">
                    <Plus className="h-4 w-4" />
                    <span className="ml-2">{t("webhooks.create")}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      {editingWebhook ? t("common.edit") : t("webhooks.create")} Webhook
                    </DialogTitle>
                    <DialogDescription>
                      Configure as notificações para sistemas externos
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("webhooks.name")} *</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Meu Webhook"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="url">{t("webhooks.url")} *</Label>
                      <Input
                        id="url"
                        type="url"
                        value={form.url}
                        onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                        placeholder="https://example.com/webhook"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="secret">{t("webhooks.secret")}</Label>
                      <Input
                        id="secret"
                        type="password"
                        value={form.secret}
                        onChange={(e) => setForm((prev) => ({ ...prev, secret: e.target.value }))}
                        placeholder="Chave secreta para validação"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t("webhooks.events")} *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {WEBHOOK_EVENTS.map((event) => (
                          <div key={event.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={event.id}
                              checked={form.events.includes(event.id)}
                              onCheckedChange={() => toggleEvent(event.id)}
                            />
                            <Label htmlFor={event.id} className="text-sm font-normal cursor-pointer">
                              {t(event.key)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        {t("common.cancel")}
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {t("common.save")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Configuration Tab */}
          <TabsContent value="config" className="mt-6">
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  Webhooks Configurados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : !webhooks?.length ? (
                  <div className="text-center py-12">
                    <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium">{t("webhooks.noWebhooks")}</p>
                    <p className="text-sm text-muted-foreground">{t("webhooks.noWebhooks.desc")}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("webhooks.name")}</TableHead>
                        <TableHead>{t("webhooks.url")}</TableHead>
                        <TableHead>{t("webhooks.events")}</TableHead>
                        <TableHead>{t("webhooks.status")}</TableHead>
                        <TableHead>{t("webhooks.lastTriggered")}</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooks.map((webhook) => (
                        <TableRow key={webhook.id}>
                          <TableCell className="font-medium">{webhook.name}</TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">
                            {webhook.url}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {webhook.events?.slice(0, 2).map((event) => (
                                <Badge key={event} variant="secondary" className="text-xs">
                                  {event}
                                </Badge>
                              ))}
                              {webhook.events?.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{webhook.events.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={webhook.is_active}
                              onCheckedChange={(checked) =>
                                updateMutation.mutate({
                                  id: webhook.id,
                                  data: { is_active: checked },
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {webhook.last_triggered_at
                              ? format(new Date(webhook.last_triggered_at), "dd/MM/yyyy HH:mm")
                              : t("webhooks.never")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => testWebhook(webhook.id)}
                                disabled={testingWebhookId === webhook.id}
                                title="Testar webhook"
                              >
                                {testingWebhookId === webhook.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4 text-primary" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(webhook)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(webhook.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="mt-6">
            {webhookLogs && webhookLogs.length > 0 ? (
              <WebhookMetrics logs={webhookLogs} />
            ) : (
              <Card variant="glass">
                <CardContent className="py-12">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium">Sem dados de monitoramento</p>
                    <p className="text-sm text-muted-foreground">
                      Configure webhooks e comece a enviar eventos para ver métricas
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Queue Tab */}
          <TabsContent value="queue" className="mt-6 space-y-6">
            <FailedWebhooksQueue
              logs={webhookLogs || []}
              webhooks={webhooks || []}
            />
            
            {pendingCount > 0 && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleExportFailedCSV} className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar Falhas (CSV)
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="mt-6 space-y-6">
            {user && (
              <WebhookAutoRetrySettings
                userId={user.id}
                onSettingsChange={handleAutoRetrySettingsChange}
              />
            )}

            {/* Background Cron Job Section */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  Retry em Background (Cron Job)
                </CardTitle>
                <CardDescription>
                  Execute retry de webhooks mesmo quando o navegador estiver fechado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button 
                    onClick={runCronJobManually} 
                    disabled={isRunningCronJob}
                    className="gap-2"
                  >
                    {isRunningCronJob ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Executar Agora
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Reprocessa webhooks falhados nas últimas {autoRetrySettings?.retryOlderThanHours || 24}h
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">Configurar execução automática:</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Para executar automaticamente em segundo plano, configure um cron job no banco de dados.
                    Execute o seguinte SQL no painel de administração:
                  </p>
                  <pre className="text-xs bg-background p-3 rounded overflow-auto border">
{`-- Habilitar extensões necessárias (se ainda não estiverem)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agendar retry a cada 15 minutos
SELECT cron.schedule(
  'retry-failed-webhooks',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retry-webhooks',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}"}'::jsonb,
    body:='{"maxRetries": 3, "retryOlderThanHours": 24}'::jsonb
  );
  $$
);

-- Para remover o agendamento:
-- SELECT cron.unschedule('retry-failed-webhooks');`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="mt-6 space-y-4">
            {/* Filters */}
            <WebhookLogsFilter
              filters={logsFilters}
              onFiltersChange={setLogsFilters}
              eventTypes={eventTypes}
            />

            {filteredLogs && filteredLogs.length > 0 ? (
              <Card variant="glass">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      {t("webhooks.logs")}
                      <Badge variant="secondary" className="ml-2">
                        {filteredLogs.length} {filteredLogs.length !== webhookLogs?.length && `de ${webhookLogs?.length}`}
                      </Badge>
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Download className="h-4 w-4" />
                          Exportar
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Exportar CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportJSON} className="gap-2">
                          <FileJson className="h-4 w-4" />
                          Exportar JSON
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Accordion type="single" collapsible className="w-full">
                    {paginatedLogs.map((log) => (
                      <AccordionItem key={log.id} value={log.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3">
                            {log.success ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <Badge variant="secondary">{log.event_type}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                            </span>
                            {log.response_status && (
                              <Badge
                                variant={log.response_status >= 200 && log.response_status < 300 ? "success" : "destructive"}
                              >
                                {log.response_status}
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Payload:</span>
                              <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                            {log.response_body && (
                              <div>
                                <span className="font-medium">Response:</span>
                                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                                  {log.response_body}
                                </pre>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  {/* Pagination */}
                  {filteredLogs.length > 0 && (
                    <WebhookLogsPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      totalItems={filteredLogs.length}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  )}
                </CardContent>
              </Card>
            ) : webhookLogs && webhookLogs.length > 0 ? (
              <Card variant="glass">
                <CardContent className="py-12">
                  <div className="text-center">
                    <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium">Nenhum log encontrado</p>
                    <p className="text-sm text-muted-foreground">
                      Tente ajustar os filtros para ver mais resultados
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card variant="glass">
                <CardContent className="py-12">
                  <div className="text-center">
                    <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium">Nenhum log disponível</p>
                    <p className="text-sm text-muted-foreground">
                      Os logs aparecerão aqui quando webhooks forem disparados
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
