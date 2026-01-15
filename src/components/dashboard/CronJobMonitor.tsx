import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/hooks/useLanguage";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Activity,
  Bell,
  Timer,
  TrendingUp,
  Play,
  Loader2,
  BellRing,
  Settings2,
  BellOff
} from "lucide-react";
import { formatDistanceToNow, format, differenceInMinutes } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const MIN_INTERVAL_KEY = "cron_min_interval_minutes";
const DEFAULT_MIN_INTERVAL = 5; // 5 minutes default

interface CronJobLog {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  result: {
    stale_count?: number;
    users_notified?: number;
    message?: string;
  } | null;
  error_message: string | null;
}

interface WebhookAlertLog {
  id: string;
  event_type: string;
  created_at: string;
  success: boolean;
  response_status: number | null;
  payload: {
    data?: {
      count?: number;
      imports?: Array<{
        batch_id: string;
        hours_paused: number;
      }>;
    };
  } | null;
}

export function CronJobMonitor() {
  const { t, language } = useLanguage();
  const pushNotifications = usePushNotifications();
  const [cronLogs, setCronLogs] = useState<CronJobLog[]>([]);
  const [alertLogs, setAlertLogs] = useState<WebhookAlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningManual, setRunningManual] = useState(false);
  const [minInterval, setMinInterval] = useState(() => {
    const stored = localStorage.getItem(MIN_INTERVAL_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_MIN_INTERVAL;
  });
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [stats, setStats] = useState({
    totalExecutions: 0,
    successRate: 0,
    totalAlerts: 0,
    alertSuccessRate: 0,
    avgDuration: 0,
  });

  const dateLocale = language === 'pt-BR' ? ptBR : enUS;

  // Check cooldown based on last manual execution
  const checkCooldown = useCallback(() => {
    const lastManualRun = localStorage.getItem("last_manual_cron_run");
    if (!lastManualRun) return 0;

    const lastRunDate = new Date(lastManualRun);
    const now = new Date();
    const minutesPassed = differenceInMinutes(now, lastRunDate);
    const remaining = Math.max(0, minInterval - minutesPassed);
    return remaining;
  }, [minInterval]);

  useEffect(() => {
    const remaining = checkCooldown();
    setCooldownRemaining(remaining);

    if (remaining > 0) {
      const interval = setInterval(() => {
        const newRemaining = checkCooldown();
        setCooldownRemaining(newRemaining);
        if (newRemaining === 0) {
          clearInterval(interval);
        }
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    }
  }, [checkCooldown, minInterval]);

  useEffect(() => {
    fetchData();
  }, []);

  // Subscribe to realtime alerts for push notifications
  useEffect(() => {
    if (!pushNotifications.isEnabled) return;

    const channel = supabase
      .channel('stale-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_logs',
          filter: 'event_type=eq.stale_import_alert'
        },
        (payload) => {
          const newAlert = payload.new as WebhookAlertLog;
          const count = (newAlert.payload as any)?.data?.count || 0;
          
          pushNotifications.sendNotification(
            t("cronMonitor.alertNotificationTitle") || "⚠️ Alerta de Importação",
            {
              body: `${count} ${t("cronMonitor.alertNotificationBody") || "importações pausadas há mais de 24h"}`,
              tag: 'stale-import-alert',
              requireInteraction: true,
            }
          );

          // Also refresh data
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pushNotifications.isEnabled, t]);

  const handleMinIntervalChange = (value: number[]) => {
    const newValue = value[0];
    setMinInterval(newValue);
    localStorage.setItem(MIN_INTERVAL_KEY, newValue.toString());
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch cron job logs
      const { data: cronData, error: cronError } = await supabase
        .from('cron_job_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (cronError) throw cronError;

      // Fetch stale import alert logs from webhook_logs
      const { data: webhookData, error: webhookError } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('event_type', 'stale_import_alert')
        .order('created_at', { ascending: false })
        .limit(50);

      if (webhookError) throw webhookError;

      const typedCronLogs = (cronData || []) as CronJobLog[];
      const typedAlertLogs = (webhookData || []) as WebhookAlertLog[];

      setCronLogs(typedCronLogs);
      setAlertLogs(typedAlertLogs);

      // Calculate stats
      const successfulCron = typedCronLogs.filter(l => l.status === 'completed').length;
      const successfulAlerts = typedAlertLogs.filter(l => l.success).length;
      
      const durations = typedCronLogs
        .filter(l => l.completed_at)
        .map(l => new Date(l.completed_at!).getTime() - new Date(l.started_at).getTime());
      
      const avgDuration = durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000)
        : 0;

      setStats({
        totalExecutions: typedCronLogs.length,
        successRate: typedCronLogs.length > 0 ? Math.round((successfulCron / typedCronLogs.length) * 100) : 0,
        totalAlerts: typedAlertLogs.length,
        alertSuccessRate: typedAlertLogs.length > 0 ? Math.round((successfulAlerts / typedAlertLogs.length) * 100) : 0,
        avgDuration,
      });
    } catch (err) {
      console.error("Error fetching cron job data:", err);
    } finally {
      setLoading(false);
    }
  };

  const runManualCheck = async () => {
    // Check cooldown
    const remaining = checkCooldown();
    if (remaining > 0) {
      toast.error(t("cronMonitor.cooldownError") || "Aguarde antes de executar novamente", {
        description: `${remaining} ${t("cronMonitor.minutesRemaining") || "minuto(s) restante(s)"}`
      });
      return;
    }

    setRunningManual(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-stale-imports', {
        body: { manual: true }
      });

      if (error) throw error;

      // Store last manual run time
      localStorage.setItem("last_manual_cron_run", new Date().toISOString());
      setCooldownRemaining(minInterval);

      toast.success(t("cronMonitor.manualRunSuccess") || "Verificação executada com sucesso!", {
        description: `${data?.stale_count || 0} importações pausadas encontradas`
      });

      // Send push notification if enabled and stale imports found
      if (pushNotifications.isEnabled && data?.stale_count > 0) {
        pushNotifications.sendNotification(
          t("cronMonitor.manualCheckComplete") || "Verificação Concluída",
          {
            body: `${data.stale_count} ${t("cronMonitor.staleImportsFound") || "importações pausadas encontradas"}`,
            tag: 'manual-check-complete',
          }
        );
      }

      // Refresh data after manual run
      await fetchData();
    } catch (err) {
      console.error("Error running manual check:", err);
      toast.error(t("cronMonitor.manualRunError") || "Erro ao executar verificação", {
        description: err instanceof Error ? err.message : "Erro desconhecido"
      });
    } finally {
      setRunningManual(false);
    }
  };

  // Prepare chart data - last 7 days of executions
  const getChartData = () => {
    const last7Days: { [key: string]: { date: string; executions: number; alerts: number; success: number; failed: number } } = {};
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = format(date, 'MM/dd');
      last7Days[key] = { date: key, executions: 0, alerts: 0, success: 0, failed: 0 };
    }

    cronLogs.forEach(log => {
      const key = format(new Date(log.started_at), 'MM/dd');
      if (last7Days[key]) {
        last7Days[key].executions++;
        if (log.status === 'completed') {
          last7Days[key].success++;
        } else if (log.status === 'error') {
          last7Days[key].failed++;
        }
      }
    });

    alertLogs.forEach(log => {
      const key = format(new Date(log.created_at), 'MM/dd');
      if (last7Days[key]) {
        last7Days[key].alerts++;
      }
    });

    return Object.values(last7Days);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Activity className="h-3 w-3 mr-1 animate-pulse" /> Executando</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalExecutions}</p>
                <p className="text-sm text-muted-foreground">{t("cronMonitor.totalExecutions") || "Execuções"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.successRate}%</p>
                <p className="text-sm text-muted-foreground">{t("cronMonitor.successRate") || "Taxa de Sucesso"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <Bell className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalAlerts}</p>
                <p className="text-sm text-muted-foreground">{t("cronMonitor.alertsSent") || "Alertas Enviados"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Timer className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgDuration}s</p>
                <p className="text-sm text-muted-foreground">{t("cronMonitor.avgDuration") || "Duração Média"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{t("cronMonitor.settings") || "Configurações"}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-full ${pushNotifications.isEnabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                {pushNotifications.isEnabled ? (
                  <BellRing className="h-5 w-5 text-green-500" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <Label htmlFor="push-notifications" className="font-medium">
                  {t("cronMonitor.pushNotifications") || "Notificações Push"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("cronMonitor.pushNotificationsDesc") || "Receba alertas no navegador quando importações pausadas forem detectadas"}
                </p>
              </div>
            </div>
            <Switch
              id="push-notifications"
              checked={pushNotifications.isEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  pushNotifications.enableNotifications();
                } else {
                  pushNotifications.disableNotifications();
                }
              }}
              disabled={!pushNotifications.isSupported}
            />
          </div>

          {!pushNotifications.isSupported && (
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              {t("cronMonitor.pushNotSupported") || "Notificações push não são suportadas neste navegador"}
            </p>
          )}

          {/* Minimum Interval */}
          <div className="space-y-4">
            <div>
              <Label className="font-medium">
                {t("cronMonitor.minInterval") || "Intervalo Mínimo entre Execuções Manuais"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("cronMonitor.minIntervalDesc") || "Tempo mínimo de espera entre execuções manuais para evitar sobrecarga"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Slider
                value={[minInterval]}
                onValueChange={handleMinIntervalChange}
                min={1}
                max={60}
                step={1}
                className="flex-1"
              />
              <span className="text-sm font-medium w-20 text-right">
                {minInterval} {t("cronMonitor.minutes") || "min"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Run Button */}
      <Card className="border-dashed border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Play className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{t("cronMonitor.manualRun") || "Execução Manual"}</p>
                <p className="text-sm text-muted-foreground">
                  {t("cronMonitor.manualRunDesc") || "Execute a verificação de importações pausadas agora"}
                </p>
                {cooldownRemaining > 0 && (
                  <p className="text-xs text-warning mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {t("cronMonitor.cooldownActive") || "Aguarde"} {cooldownRemaining} {t("cronMonitor.minutes") || "min"}
                  </p>
                )}
              </div>
            </div>
            <Button 
              onClick={runManualCheck} 
              disabled={runningManual || cooldownRemaining > 0}
            >
              {runningManual ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.running") || "Executando..."}
                </>
              ) : cooldownRemaining > 0 ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  {cooldownRemaining} {t("cronMonitor.minutes") || "min"}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {t("cronMonitor.runNow") || "Executar Agora"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("cronMonitor.activityChart") || "Atividade dos Últimos 7 Dias"}</CardTitle>
              <CardDescription>{t("cronMonitor.activityChartDesc") || "Execuções do cron job e alertas enviados"}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("common.refresh") || "Atualizar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getChartData()}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Legend />
              <Bar dataKey="success" name="Sucesso" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Falhas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="alerts" name="Alertas" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Execution Logs */}
      <Card>
        <CardHeader>
          <CardTitle>{t("cronMonitor.executionHistory") || "Histórico de Execuções"}</CardTitle>
          <CardDescription>{t("cronMonitor.executionHistoryDesc") || "Últimas execuções do cron job check-stale-imports"}</CardDescription>
        </CardHeader>
        <CardContent>
          {cronLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("cronMonitor.noExecutions") || "Nenhuma execução registrada ainda"}</p>
              <p className="text-sm">{t("cronMonitor.noExecutionsDesc") || "O cron job é executado automaticamente a cada hora"}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {cronLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-muted">
                      {log.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : log.status === 'error' ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Activity className="h-5 w-5 text-blue-500 animate-pulse" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{log.job_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.started_at), { addSuffix: true, locale: dateLocale })}
                      </p>
                      {log.result && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {log.result.stale_count || 0} importações encontradas • {log.result.users_notified || 0} usuários notificados
                        </p>
                      )}
                      {log.error_message && (
                        <p className="text-xs text-destructive mt-1">{log.error_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {log.completed_at && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s
                      </span>
                    )}
                    {getStatusBadge(log.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Logs */}
      <Card>
        <CardHeader>
          <CardTitle>{t("cronMonitor.alertHistory") || "Histórico de Alertas"}</CardTitle>
          <CardDescription>{t("cronMonitor.alertHistoryDesc") || "Alertas de importações pausadas enviados via webhook"}</CardDescription>
        </CardHeader>
        <CardContent>
          {alertLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("cronMonitor.noAlerts") || "Nenhum alerta enviado ainda"}</p>
              <p className="text-sm">{t("cronMonitor.noAlertsDesc") || "Alertas são enviados quando importações ficam pausadas por mais de 24h"}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alertLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${log.success ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                      {log.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Alerta de Importação Pausada</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: dateLocale })}
                      </p>
                      {log.payload?.data && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {log.payload.data.count || 0} importações alertadas
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {log.response_status && (
                      <span className="text-xs text-muted-foreground">
                        HTTP {log.response_status}
                      </span>
                    )}
                    {log.success ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Enviado</Badge>
                    ) : (
                      <Badge variant="destructive">Falha</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
