import { useState, useEffect } from "react";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Clock,
  Webhook,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ScheduledReport {
  id: string;
  name: string;
  webhook_url: string;
  webhook_secret: string | null;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  hour_of_day: number;
  report_type: string;
  is_active: boolean;
  last_sent_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

interface ReportLog {
  id: string;
  status: string;
  response_status: number | null;
  error_message: string | null;
  created_at: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

export function ScheduledReportsManager() {
  const { user } = useRequireAuth();
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [logs, setLogs] = useState<Record<string, ReportLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [sendingTest, setSendingTest] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    webhook_url: "",
    webhook_secret: "",
    frequency: "daily",
    day_of_week: 1,
    day_of_month: 1,
    hour_of_day: 8,
    report_type: "all",
  });

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user]);

  const loadReports = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("scheduled_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Type assertion to ensure proper typing
      const typedData = (data || []) as unknown as ScheduledReport[];
      setReports(typedData);

      // Load logs for each report
      const logsMap: Record<string, ReportLog[]> = {};
      for (const report of typedData) {
        const { data: logData } = await supabase
          .from("report_logs")
          .select("id, status, response_status, error_message, created_at")
          .eq("scheduled_report_id", report.id)
          .order("created_at", { ascending: false })
          .limit(5);

        logsMap[report.id] = (logData || []) as unknown as ReportLog[];
      }
      setLogs(logsMap);
    } catch (err) {
      console.error("Error loading scheduled reports:", err);
      toast.error("Erro ao carregar relatórios agendados");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!formData.name || !formData.webhook_url) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      // Calculate next run time
      const now = new Date();
      const nextRun = new Date(now);
      nextRun.setHours(formData.hour_of_day, 0, 0, 0);

      if (formData.frequency === "daily") {
        if (now.getHours() >= formData.hour_of_day) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
      } else if (formData.frequency === "weekly") {
        const currentDay = now.getDay();
        let daysUntilTarget = formData.day_of_week - currentDay;
        if (daysUntilTarget < 0 || (daysUntilTarget === 0 && now.getHours() >= formData.hour_of_day)) {
          daysUntilTarget += 7;
        }
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      } else if (formData.frequency === "monthly") {
        nextRun.setDate(formData.day_of_month);
        if (now.getDate() > formData.day_of_month || 
            (now.getDate() === formData.day_of_month && now.getHours() >= formData.hour_of_day)) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
      }

      const { error } = await supabase.from("scheduled_reports").insert({
        user_id: user.id,
        name: formData.name,
        webhook_url: formData.webhook_url,
        webhook_secret: formData.webhook_secret || null,
        frequency: formData.frequency,
        day_of_week: formData.frequency === "weekly" ? formData.day_of_week : null,
        day_of_month: formData.frequency === "monthly" ? formData.day_of_month : null,
        hour_of_day: formData.hour_of_day,
        report_type: formData.report_type,
        next_run_at: nextRun.toISOString(),
      });

      if (error) throw error;

      toast.success("Relatório agendado criado com sucesso");
      setDialogOpen(false);
      setFormData({
        name: "",
        webhook_url: "",
        webhook_secret: "",
        frequency: "daily",
        day_of_week: 1,
        day_of_month: 1,
        hour_of_day: 8,
        report_type: "all",
      });
      loadReports();
    } catch (err) {
      console.error("Error creating scheduled report:", err);
      toast.error("Erro ao criar relatório agendado");
    }
  };

  const handleToggleActive = async (report: ScheduledReport) => {
    try {
      const { error } = await supabase
        .from("scheduled_reports")
        .update({ is_active: !report.is_active })
        .eq("id", report.id);

      if (error) throw error;

      toast.success(report.is_active ? "Relatório pausado" : "Relatório ativado");
      loadReports();
    } catch (err) {
      console.error("Error toggling report:", err);
      toast.error("Erro ao atualizar relatório");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("scheduled_reports")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      toast.success("Relatório excluído com sucesso");
      setDeleteId(null);
      loadReports();
    } catch (err) {
      console.error("Error deleting report:", err);
      toast.error("Erro ao excluir relatório");
    }
  };

  const handleSendTest = async (report: ScheduledReport) => {
    setSendingTest(report.id);

    try {
      const { error } = await supabase.functions.invoke("send-scheduled-reports", {
        body: { testReportId: report.id },
      });

      if (error) throw error;

      toast.success("Relatório de teste enviado");
      loadReports();
    } catch (err) {
      console.error("Error sending test report:", err);
      toast.error("Erro ao enviar relatório de teste");
    } finally {
      setSendingTest(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const getFrequencyLabel = (report: ScheduledReport) => {
    if (report.frequency === "daily") {
      return `Diário às ${report.hour_of_day.toString().padStart(2, "0")}:00`;
    }
    if (report.frequency === "weekly") {
      const day = DAYS_OF_WEEK.find((d) => d.value === report.day_of_week);
      return `Semanal - ${day?.label} às ${report.hour_of_day.toString().padStart(2, "0")}:00`;
    }
    if (report.frequency === "monthly") {
      return `Mensal - Dia ${report.day_of_month} às ${report.hour_of_day.toString().padStart(2, "0")}:00`;
    }
    return report.frequency;
  };

  if (loading) {
    return (
      <Card variant="glass">
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                Relatórios Agendados
              </CardTitle>
              <CardDescription>
                Configure webhooks para receber relatórios automaticamente
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Agendamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Novo Relatório Agendado</DialogTitle>
                  <DialogDescription>
                    Configure um webhook para receber relatórios automaticamente
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome do Relatório *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Relatório Diário"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>URL do Webhook *</Label>
                    <Input
                      value={formData.webhook_url}
                      onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                      placeholder="https://seu-servidor.com/webhook"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Secret (opcional)</Label>
                    <Input
                      type="password"
                      value={formData.webhook_secret}
                      onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
                      placeholder="Assinatura HMAC-SHA256"
                    />
                    <p className="text-xs text-muted-foreground">
                      Se definido, cada requisição incluirá um header X-Webhook-Signature
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(v) => setFormData({ ...formData, frequency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.frequency === "weekly" && (
                    <div className="space-y-2">
                      <Label>Dia da Semana</Label>
                      <Select
                        value={formData.day_of_week.toString()}
                        onValueChange={(v) => setFormData({ ...formData, day_of_week: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((day) => (
                            <SelectItem key={day.value} value={day.value.toString()}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.frequency === "monthly" && (
                    <div className="space-y-2">
                      <Label>Dia do Mês</Label>
                      <Select
                        value={formData.day_of_month.toString()}
                        onValueChange={(v) => setFormData({ ...formData, day_of_month: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                            <SelectItem key={day} value={day.toString()}>
                              Dia {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Select
                      value={formData.hour_of_day.toString()}
                      onValueChange={(v) => setFormData({ ...formData, hour_of_day: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((hour) => (
                          <SelectItem key={hour.value} value={hour.value.toString()}>
                            {hour.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Relatório</Label>
                    <Select
                      value={formData.report_type}
                      onValueChange={(v) => setFormData({ ...formData, report_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Completo</SelectItem>
                        <SelectItem value="analytics">Apenas Analytics</SelectItem>
                        <SelectItem value="products">Apenas Produtos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate}>Criar Agendamento</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum relatório agendado</p>
              <p className="text-sm">Configure webhooks para receber relatórios automaticamente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id} className="border">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{report.name}</h4>
                          <Badge variant={report.is_active ? "default" : "secondary"}>
                            {report.is_active ? "Ativo" : "Pausado"}
                          </Badge>
                          <Badge variant="outline">{report.report_type}</Badge>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {getFrequencyLabel(report)}
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Webhook className="h-4 w-4 text-muted-foreground" />
                          <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-md">
                            {report.webhook_url}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(report.webhook_url)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>

                        {report.webhook_secret && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Secret:</span>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {showSecrets[report.id]
                                ? report.webhook_secret
                                : "••••••••••••"}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                setShowSecrets({
                                  ...showSecrets,
                                  [report.id]: !showSecrets[report.id],
                                })
                              }
                            >
                              {showSecrets[report.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {report.last_sent_at && (
                            <span>
                              Último envio:{" "}
                              {formatDistanceToNow(new Date(report.last_sent_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          )}
                          {report.next_run_at && (
                            <span>
                              Próximo:{" "}
                              {format(new Date(report.next_run_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={report.is_active}
                          onCheckedChange={() => handleToggleActive(report)}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleSendTest(report)}
                          disabled={sendingTest === report.id}
                        >
                          {sendingTest === report.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(report.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Logs */}
                    {logs[report.id] && logs[report.id].length > 0 && (
                      <Collapsible
                        open={expandedLogs[report.id]}
                        onOpenChange={(open) =>
                          setExpandedLogs({ ...expandedLogs, [report.id]: open })
                        }
                        className="mt-4"
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
                            {expandedLogs[report.id] ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            Histórico de envios ({logs[report.id].length})
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Código</TableHead>
                                <TableHead>Erro</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {logs[report.id].map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-xs">
                                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", {
                                      locale: ptBR,
                                    })}
                                  </TableCell>
                                  <TableCell>
                                    {log.status === "success" ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {log.response_status || "-"}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                    {log.error_message || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Relatório Agendado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este relatório agendado? Esta ação não pode ser
              desfeita e todo o histórico de envios será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
