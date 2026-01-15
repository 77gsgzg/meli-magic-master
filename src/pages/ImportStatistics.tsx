import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BatchImportStats } from "@/components/dashboard/BatchImportStats";
import { ResumableImports } from "@/components/dashboard/ResumableImports";
import { CronJobMonitor } from "@/components/dashboard/CronJobMonitor";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Clock, AlertTriangle, Bell, RefreshCw, Activity } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PausedImportAlert {
  id: string;
  batch_id: string;
  total_urls: number;
  success_count: number;
  failed_count: number;
  started_at: string;
  hours_paused: number;
}

export default function ImportStatistics() {
  const { t } = useLanguage();
  const { session } = useRequireAuth();
  const [staleImports, setStaleImports] = useState<PausedImportAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      checkStaleImports();
    }
  }, [session?.user?.id]);

  const checkStaleImports = async () => {
    setLoading(true);
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from('batch_import_logs')
        .select('*')
        .eq('is_paused', true)
        .eq('can_resume', true)
        .lt('started_at', twentyFourHoursAgo.toISOString())
        .order('started_at', { ascending: false });

      if (error) throw error;

      const alertData = (data || []).map(item => ({
        id: item.id,
        batch_id: item.batch_id,
        total_urls: item.total_urls,
        success_count: item.success_count,
        failed_count: item.failed_count,
        started_at: item.started_at,
        hours_paused: Math.round((Date.now() - new Date(item.started_at).getTime()) / (1000 * 60 * 60)),
      }));

      setStaleImports(alertData);
    } catch (err) {
      console.error("Error checking stale imports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeAll = async () => {
    if (staleImports.length === 0) return;

    toast.info("Retomando importações pausadas...");

    for (const importItem of staleImports) {
      try {
        const { data: logData } = await supabase
          .from('batch_import_logs')
          .select('remaining_urls')
          .eq('id', importItem.id)
          .single();

        if (logData?.remaining_urls && logData.remaining_urls.length > 0) {
          const response = await supabase.functions.invoke('batch-import', {
            body: {
              urls: logData.remaining_urls,
              resumeFromLogId: importItem.id,
            },
          });

          if (response.error) {
            throw new Error(response.error.message);
          }
        }
      } catch (err) {
        console.error(`Error resuming import ${importItem.id}:`, err);
      }
    }

    toast.success("Importações retomadas!");
    checkStaleImports();
  };

  return (
    <DashboardLayout 
      title={t("importStats.title")} 
      subtitle={t("importStats.subtitle")}
    >
      <div className="space-y-6">
        {/* Action buttons */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={checkStaleImports} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t("common.refresh") || "Atualizar"}
          </Button>
        </div>

        {/* Stale Imports Alert */}
        {staleImports.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <CardTitle className="text-base">{t("importStats.staleAlertTitle")}</CardTitle>
                </div>
                <Badge variant="warning">{staleImports.length} {staleImports.length === 1 ? 'importação' : 'importações'}</Badge>
              </div>
              <CardDescription>
                {t("importStats.staleAlertDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {staleImports.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-warning" />
                      <div>
                        <p className="text-sm font-medium">
                          Lote: {item.batch_id.substring(0, 8)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pausado há {item.hours_paused}h • {item.success_count}/{item.total_urls} processadas
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-warning">
                      <Bell className="h-3 w-3 mr-1" />
                      Pendente há mais de 24h
                    </Badge>
                  </div>
                ))}
                <Button onClick={handleResumeAll} className="w-full mt-2">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t("importStats.resumeAll")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="stats">{t("importStats.statsTab")}</TabsTrigger>
            <TabsTrigger value="pending">{t("importStats.pendingTab")}</TabsTrigger>
            <TabsTrigger value="monitor" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              {t("importStats.monitorTab") || "Monitoramento"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="space-y-6">
            <BatchImportStats />
          </TabsContent>

          <TabsContent value="pending" className="space-y-6">
            <ResumableImports />
          </TabsContent>

          <TabsContent value="monitor" className="space-y-6">
            <CronJobMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
