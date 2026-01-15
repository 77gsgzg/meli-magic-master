import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  PlayCircle, 
  Trash2, 
  Loader2, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useAuth";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PausedImport {
  id: string;
  batch_id: string;
  total_urls: number;
  success_count: number;
  failed_count: number;
  processed_urls: string[];
  remaining_urls: string[];
  status: string;
  started_at: string;
  is_paused: boolean;
  can_resume: boolean;
}

export function ResumableImports() {
  const { session } = useRequireAuth();
  const { connection } = useMercadoLivre();
  const [pausedImports, setPausedImports] = useState<PausedImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumingId, setResumingId] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchPausedImports();
    }
  }, [session?.user?.id]);

  const fetchPausedImports = async () => {
    try {
      const { data, error } = await supabase
        .from('batch_import_logs')
        .select('*')
        .eq('is_paused', true)
        .eq('can_resume', true)
        .order('started_at', { ascending: false });

      if (error) throw error;
      setPausedImports((data as PausedImport[]) || []);
    } catch (err) {
      console.error("Error fetching paused imports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async (importData: PausedImport) => {
    if (!session?.access_token || !connection.connected) {
      toast.error("Verifique a conexão com o Mercado Livre");
      return;
    }

    setResumingId(importData.id);

    try {
      // Update status to processing
      await supabase
        .from('batch_import_logs')
        .update({ is_paused: false, status: 'processing' })
        .eq('id', importData.id);

      // Call batch-import with remaining URLs and reference to the log
      const response = await supabase.functions.invoke('batch-import', {
        body: { 
          urls: importData.remaining_urls,
          resume_log_id: importData.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      if (result.success) {
        toast.success(`Retomado: ${result.successCount} publicado(s)!`);
        fetchPausedImports();
      }
    } catch (err) {
      console.error("Error resuming import:", err);
      toast.error("Erro ao retomar importação");
      
      // Revert status
      await supabase
        .from('batch_import_logs')
        .update({ is_paused: true })
        .eq('id', importData.id);
    } finally {
      setResumingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Mark as no longer resumable instead of deleting
      await supabase
        .from('batch_import_logs')
        .update({ can_resume: false, is_paused: false })
        .eq('id', id);

      toast.success("Importação descartada");
      fetchPausedImports();
    } catch (err) {
      console.error("Error deleting paused import:", err);
      toast.error("Erro ao descartar importação");
    }
  };

  if (loading) {
    return (
      <Card variant="glass">
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (pausedImports.length === 0) {
    return null; // Don't show card if no paused imports
  }

  return (
    <Card variant="glass" className="animate-fade-in overflow-hidden relative border-warning/30">
      <div className="absolute inset-0 bg-gradient-to-br from-warning/5 via-transparent to-transparent" />
      <CardHeader className="relative pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <div>
            <CardTitle className="text-base">Importações Pausadas</CardTitle>
            <CardDescription className="text-xs">
              {pausedImports.length} importação(ões) aguardando retomada
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative">
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-2">
            {pausedImports.map((importData) => {
              const processed = importData.processed_urls?.length || 0;
              const remaining = importData.remaining_urls?.length || 0;
              const total = processed + remaining;
              const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

              return (
                <div
                  key={importData.id}
                  className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pausado
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(importData.started_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1"
                        onClick={() => handleResume(importData)}
                        disabled={resumingId === importData.id || !connection.connected}
                      >
                        {resumingId === importData.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <PlayCircle className="h-3 w-3" />
                        )}
                        Retomar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDelete(importData.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Progresso: {processed}/{total} URLs
                      </span>
                      <span className="font-medium">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5" />
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {importData.success_count} sucesso
                    </span>
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-3 w-3" />
                      {importData.failed_count} falha
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <RefreshCw className="h-3 w-3" />
                      {remaining} restante(s)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
