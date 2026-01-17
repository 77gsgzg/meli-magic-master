import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Activity, AlertTriangle, Bell, Clock, ExternalLink, Filter, Loader2, Play, RefreshCw, TriangleAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOrderAlertSettings } from "@/hooks/useOrderAlertSettings";
import { useNavigate } from "react-router-dom";

const MANUAL_COOLDOWN_KEY = "orders_cron_manual_cooldown_minutes";
const LAST_MANUAL_RUN_KEY = "orders_cron_last_manual_run";

type CronJobLog = {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  result: any;
  error_message: string | null;
};

type OperationLog = {
  id: string;
  created_at: string;
  status: string;
  details: any;
  error_message: string | null;
};

export default function OrdersCronMonitor() {
  const { loading: authLoading } = useRequireAuth();
  const { settings, update, updating } = useOrderAlertSettings();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<CronJobLog[]>([]);
  const [alerts, setAlerts] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningManual, setRunningManual] = useState(false);

  // Filters
  const [jobName, setJobName] = useState<string>("cron_sync_orders");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [errorsOnly, setErrorsOnly] = useState(false);

  // Drawer
  const [open, setOpen] = useState(false);
  const [selectedCron, setSelectedCron] = useState<CronJobLog | null>(null);

  // Test alert dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testPayload, setTestPayload] = useState<{
    action: string;
    threshold_hours: number;
    simulated_count: number;
    note: string;
  }>({
    action: "shipping_delay_alert",
    threshold_hours: settings.shipping_delay_hours,
    simulated_count: 1,
    note: "Teste manual disparado pelo usuário",
  });
  const [sendingTest, setSendingTest] = useState(false);

  const [minInterval, setMinInterval] = useState(() => {
    const stored = localStorage.getItem(MANUAL_COOLDOWN_KEY);
    return stored ? parseInt(stored, 10) : 10;
  });

  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const checkCooldown = useCallback(() => {
    const last = localStorage.getItem(LAST_MANUAL_RUN_KEY);
    if (!last) return 0;
    const lastMs = new Date(last).getTime();
    const diffMin = Math.floor((Date.now() - lastMs) / 60000);
    return Math.max(0, minInterval - diffMin);
  }, [minInterval]);

  useEffect(() => {
    const remaining = checkCooldown();
    setCooldownRemaining(remaining);

    if (remaining > 0) {
      const interval = setInterval(() => {
        const newRemaining = checkCooldown();
        setCooldownRemaining(newRemaining);
        if (newRemaining === 0) clearInterval(interval);
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [checkCooldown]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let cronQuery = supabase
        .from("cron_job_logs")
        .select("id,job_name,started_at,completed_at,status,result,error_message")
        .order("started_at", { ascending: false })
        .limit(50);

      if (jobName !== "all") cronQuery = cronQuery.eq("job_name", jobName);
      if (errorsOnly) cronQuery = cronQuery.eq("status", "error");
      else if (statusFilter !== "all") cronQuery = cronQuery.eq("status", statusFilter);

      const [{ data: cronData, error: cronError }, { data: alertData, error: alertError }] = await Promise.all([
        cronQuery,
        supabase
          .from("operation_logs")
          .select("id,created_at,status,details,error_message")
          .or("details->action.eq.shipping_delay_alert,details->action.eq.shipping_delay_alert_test")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (cronError) throw cronError;
      if (alertError) throw alertError;

      setLogs((cronData || []) as any);
      setAlerts((alertData || []) as any);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar monitoramento", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }, [jobName, statusFilter, errorsOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update testPayload threshold when settings change
  useEffect(() => {
    setTestPayload((prev) => ({ ...prev, threshold_hours: settings.shipping_delay_hours }));
  }, [settings.shipping_delay_hours]);

  const lastRun = logs[0];
  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter((l) => l.status === "success").length;
    const failed = logs.filter((l) => l.status === "error").length;
    return { total, success, failed };
  }, [logs]);

  const runManual = async () => {
    const remaining = checkCooldown();
    if (remaining > 0) {
      toast.error("Aguarde antes de executar novamente", { description: `${remaining} min restante(s)` });
      return;
    }

    setRunningManual(true);
    try {
      const { data, error } = await supabase.functions.invoke("cron-sync-orders", { body: { manual: true } });
      if (error) throw error;

      localStorage.setItem(LAST_MANUAL_RUN_KEY, new Date().toISOString());
      setCooldownRemaining(minInterval);

      toast.success("Sincronização manual executada", {
        description: `Novos pedidos: ${data?.new_orders ?? 0}`,
      });

      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro na sincronização manual", { description: e?.message });
    } finally {
      setRunningManual(false);
    }
  };

  const sendTestAlert = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-order-alert", {
        body: testPayload,
      });
      if (error) throw error;

      toast.success("Alerta de teste registrado!", {
        description: `action: ${testPayload.action}_test`,
      });
      setTestDialogOpen(false);
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao disparar alerta de teste", { description: e?.message });
    } finally {
      setSendingTest(false);
    }
  };

  const statusBadge = (s: string) => {
    if (s === "success") return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Sucesso</Badge>;
    if (s === "error") return <Badge variant="destructive">Erro</Badge>;
    if (s === "running") return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Executando</Badge>;
    if (s === "info") return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Info</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  const goToEventsWithFilter = (alertId: string) => {
    navigate(`/events?search=${alertId}`);
  };

  if (authLoading) {
    return (
      <DashboardLayout title="Monitor de Pedidos" subtitle="Carregando...">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Monitor de Pedidos" subtitle="Cron, histórico e alertas de atraso no envio">
      <div className="space-y-4">
        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Execuções</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Activity className="h-6 w-6 text-primary opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sucesso</p>
                  <p className="text-2xl font-bold">{stats.success}</p>
                </div>
                <Clock className="h-6 w-6 text-primary opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Falhas</p>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                </div>
                <TriangleAlert className="h-6 w-6 text-primary opacity-60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters card */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filtros do histórico
            </CardTitle>
            <CardDescription>Filtre por job, status ou somente erros.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4 items-end">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Job</p>
              <Select value={jobName} onValueChange={setJobName}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="cron_sync_orders">cron_sync_orders</SelectItem>
                  <SelectItem value="check-stale-imports">check-stale-imports</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={errorsOnly}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">success</SelectItem>
                  <SelectItem value="error">error</SelectItem>
                  <SelectItem value="running">running</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 h-10">
              <Switch checked={errorsOnly} onCheckedChange={setErrorsOnly} id="errors-only" />
              <Label htmlFor="errors-only" className="text-sm">Somente erros</Label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchData} disabled={loading} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Manual execution */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Execução manual
            </CardTitle>
            <CardDescription>
              Respeita cooldown para evitar excesso. Última execução: {lastRun?.started_at ? formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true, locale: ptBR }) : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="space-y-3">
              <Label className="text-sm">Cooldown mínimo</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[minInterval]}
                  min={1}
                  max={60}
                  step={1}
                  onValueChange={(v) => {
                    const n = v[0];
                    setMinInterval(n);
                    localStorage.setItem(MANUAL_COOLDOWN_KEY, String(n));
                  }}
                  className="w-64"
                />
                <span className="text-sm font-medium">{minInterval} min</span>
              </div>
              {cooldownRemaining > 0 && (
                <p className="text-xs text-muted-foreground">Aguarde {cooldownRemaining} min para executar novamente.</p>
              )}
            </div>
            <Button onClick={runManual} disabled={runningManual || cooldownRemaining > 0}>
              {runningManual ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Executar agora
            </Button>
          </CardContent>
        </Card>

        {/* Configurable alerts + test button */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Alertas configuráveis
            </CardTitle>
            <CardDescription>Atraso no envio gera eventos em operation_logs (somente dados reais).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Alerta de atraso no envio</Label>
                <p className="text-sm text-muted-foreground">Dispara quando um pedido pago ficar sem envio por X horas.</p>
              </div>
              <Switch
                checked={settings.shipping_delay_alert_enabled}
                onCheckedChange={(v) => update({ shipping_delay_alert_enabled: v })}
                disabled={updating}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Limite (horas)</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.shipping_delay_hours]}
                  min={1}
                  max={168}
                  step={1}
                  onValueChange={(v) => update({ shipping_delay_hours: v[0] })}
                  disabled={updating || !settings.shipping_delay_alert_enabled}
                  className="w-64"
                />
                <span className="text-sm font-medium">{settings.shipping_delay_hours}h</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50">
              <Button variant="outline" onClick={() => setTestDialogOpen(true)}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Disparar alerta de teste
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Simula o registro de um alerta para validação, sem afetar dados reais.</p>
            </div>
          </CardContent>
        </Card>

        {/* Cron history */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Histórico do cron</CardTitle>
            <CardDescription>Clique em uma execução para ver detalhes.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : logs.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">Sem execuções registradas.</div>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 15).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-background/40 hover:bg-background/60 transition-colors"
                    onClick={() => {
                      setSelectedCron(l);
                      setOpen(true);
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{l.job_name} • {new Date(l.started_at).toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {l.result?.new_orders != null ? `Novos pedidos: ${l.result.new_orders}` : ""}
                        {l.error_message ? ` • ${l.error_message}` : ""}
                      </p>
                    </div>
                    {statusBadge(l.status)}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registered alerts */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Alertas registrados</CardTitle>
            <CardDescription>operation_logs.details.action = shipping_delay_alert*</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : alerts.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">Nenhum alerta registrado.</div>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 15).map((a) => (
                  <div key={a.id} className="p-3 rounded-lg border border-border/50 bg-background/40">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{new Date(a.created_at).toLocaleString("pt-BR")}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {a.details?.action ? `action: ${a.details.action}` : ""}
                          {a.details?.count != null ? ` • Pedidos: ${a.details.count}` : ""}
                          {a.details?.threshold_hours != null ? ` • Limite: ${a.details.threshold_hours}h` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{a.status}</Badge>
                        <Button variant="ghost" size="icon" onClick={() => goToEventsWithFilter(a.id)} title="Ver em Eventos">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cron detail drawer */}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>Detalhes da execução</DrawerTitle>
              <DrawerDescription>
                {selectedCron?.job_name} • {selectedCron?.status} • {selectedCron?.id}
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-4 pb-6 space-y-3 overflow-auto">
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Iniciado</p>
                  <p className="text-sm font-medium">
                    {selectedCron?.started_at ? new Date(selectedCron.started_at).toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Concluído</p>
                  <p className="text-sm font-medium">
                    {selectedCron?.completed_at ? new Date(selectedCron.completed_at).toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium">{selectedCron?.status ?? "—"}</p>
                </div>
              </div>

              {selectedCron?.error_message && (
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Erro</p>
                  <p className="text-sm">{selectedCron.error_message}</p>
                </div>
              )}

              <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground mb-2">Result (JSON)</p>
                <pre className="text-xs overflow-auto whitespace-pre-wrap break-words max-h-64">
                  {JSON.stringify(selectedCron?.result ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Test alert dialog with payload preview */}
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Disparar alerta de teste</DialogTitle>
              <DialogDescription>
                Preencha os valores abaixo e veja o payload antes de registrar em operation_logs.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Action</Label>
                <Input
                  value={testPayload.action}
                  onChange={(e) => setTestPayload((p) => ({ ...p, action: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Threshold (horas)</Label>
                <Input
                  type="number"
                  min={1}
                  value={testPayload.threshold_hours}
                  onChange={(e) => setTestPayload((p) => ({ ...p, threshold_hours: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Simulated count</Label>
                <Input
                  type="number"
                  min={0}
                  value={testPayload.simulated_count}
                  onChange={(e) => setTestPayload((p) => ({ ...p, simulated_count: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input
                  value={testPayload.note}
                  onChange={(e) => setTestPayload((p) => ({ ...p, note: e.target.value }))}
                />
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-2">Payload (preview)</p>
                <pre className="text-xs overflow-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(
                    {
                      action: `${testPayload.action}_test`,
                      threshold_hours: testPayload.threshold_hours,
                      count: testPayload.simulated_count,
                      note: testPayload.note,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={sendTestAlert} disabled={sendingTest}>
                {sendingTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
                Registrar alerta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
