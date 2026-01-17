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
import { toast } from "sonner";
import { Activity, Clock, Loader2, Play, RefreshCw, TriangleAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOrderAlertSettings } from "@/hooks/useOrderAlertSettings";

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

  const [logs, setLogs] = useState<CronJobLog[]>([]);
  const [alerts, setAlerts] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningManual, setRunningManual] = useState(false);

  const [jobName, setJobName] = useState<string>("cron_sync_orders");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [errorsOnly, setErrorsOnly] = useState(false);

  const [open, setOpen] = useState(false);
  const [selectedCron, setSelectedCron] = useState<CronJobLog | null>(null);

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
          .contains("details", { action: "shipping_delay_alert" })
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

  const statusBadge = (s: string) => {
    if (s === "success") return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Sucesso</Badge>;
    if (s === "error") return <Badge variant="destructive">Erro</Badge>;
    if (s === "running") return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Executando</Badge>;
    return <Badge variant="outline">{s}</Badge>;
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchData} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />Atualizar
              </Button>
              <Button onClick={runManual} disabled={runningManual || cooldownRemaining > 0}>
                {runningManual ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Executar agora
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Alertas configuráveis</CardTitle>
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
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Histórico do cron</CardTitle>
            <CardDescription>job_name = cron_sync_orders</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : logs.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">Sem execuções registradas.</div>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 15).map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-background/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{new Date(l.started_at).toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {l.result?.new_orders != null ? `Novos pedidos: ${l.result.new_orders}` : ""}
                        {l.error_message ? ` • ${l.error_message}` : ""}
                      </p>
                    </div>
                    {statusBadge(l.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Alertas registrados</CardTitle>
            <CardDescription>operation_logs.details.action = shipping_delay_alert</CardDescription>
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
                      <p className="text-sm font-medium">{new Date(a.created_at).toLocaleString("pt-BR")}</p>
                      <Badge variant="outline">{a.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.details?.count != null ? `Pedidos atrasados: ${a.details.count}` : ""}
                      {a.details?.threshold_hours != null ? ` • Limite: ${a.details.threshold_hours}h` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
