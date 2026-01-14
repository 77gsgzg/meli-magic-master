import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "lucide-react";
import { useRequireAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

const WEBHOOK_EVENTS = [
  { id: "publish_success", key: "webhooks.event.publish_success" },
  { id: "publish_error", key: "webhooks.event.publish_error" },
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
        .limit(50);

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

      // Refresh logs
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout title={t("webhooks.title")} subtitle={t("webhooks.subtitle")}>
      <div className="space-y-6">
        {/* Create Button */}
        <div className="flex justify-end">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                {t("webhooks.create")}
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
        </div>

        {/* Webhooks List */}
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

        {/* Webhook Logs */}
        {webhookLogs && webhookLogs.length > 0 && (
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                {t("webhooks.logs")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {webhookLogs.map((log) => (
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
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
