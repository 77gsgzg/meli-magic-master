import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  CalendarClock, 
  Plus, 
  Trash2, 
  Play,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ScheduledImport {
  id: string;
  name: string;
  urls: string[];
  frequency: string;
  hour_of_day: number;
  day_of_week: number | null;
  day_of_month: number | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

interface ImportLog {
  id: string;
  batch_id: string;
  total_urls: number;
  success_count: number;
  failed_count: number;
  status: string;
  started_at: string;
  completed_at: string | null;
}

export function ScheduledBatchImports() {
  const { session } = useRequireAuth();
  const [schedules, setSchedules] = useState<ScheduledImport[]>([]);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [urlsText, setUrlsText] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [hourOfDay, setHourOfDay] = useState(9);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);

  useEffect(() => {
    if (session?.user?.id) {
      fetchSchedules();
      fetchLogs();
    }
  }, [session?.user?.id]);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_batch_imports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (err) {
      console.error("Error fetching schedules:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('batch_import_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  const parseUrls = (text: string): string[] => {
    return text
      .split(/[\n,;]+/)
      .map(url => url.trim())
      .filter(url => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      });
  };

  const calculateNextRunAt = (): string => {
    const now = new Date();
    let nextRun = new Date();
    nextRun.setMinutes(0, 0, 0);
    nextRun.setHours(hourOfDay);

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    if (frequency === 'weekly') {
      while (nextRun.getDay() !== dayOfWeek || nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    } else if (frequency === 'monthly') {
      nextRun.setDate(dayOfMonth);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
    }

    return nextRun.toISOString();
  };

  const handleCreateSchedule = async () => {
    const urls = parseUrls(urlsText);
    
    if (!name.trim()) {
      toast.error("Digite um nome para o agendamento");
      return;
    }

    if (urls.length === 0) {
      toast.error("Adicione pelo menos uma URL válida");
      return;
    }

    if (urls.length > 20) {
      toast.error("Máximo de 20 URLs por agendamento");
      return;
    }

    try {
      const { error } = await supabase
        .from('scheduled_batch_imports')
        .insert({
          user_id: session?.user?.id,
          name: name.trim(),
          urls,
          frequency,
          hour_of_day: hourOfDay,
          day_of_week: frequency === 'weekly' ? dayOfWeek : null,
          day_of_month: frequency === 'monthly' ? dayOfMonth : null,
          next_run_at: calculateNextRunAt(),
        });

      if (error) throw error;

      toast.success("Agendamento criado!");
      setIsDialogOpen(false);
      resetForm();
      fetchSchedules();
    } catch (err) {
      console.error("Error creating schedule:", err);
      toast.error("Erro ao criar agendamento");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('scheduled_batch_imports')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      fetchSchedules();
    } catch (err) {
      console.error("Error toggling schedule:", err);
      toast.error("Erro ao atualizar agendamento");
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_batch_imports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Agendamento removido");
      fetchSchedules();
    } catch (err) {
      console.error("Error deleting schedule:", err);
      toast.error("Erro ao remover agendamento");
    }
  };

  const handleRunNow = async (schedule: ScheduledImport) => {
    if (!session?.access_token) return;

    setRunningScheduleId(schedule.id);

    try {
      const response = await supabase.functions.invoke('batch-import', {
        body: { urls: schedule.urls },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao executar importação');
      }

      const data = response.data;

      if (data.success) {
        toast.success(`${data.successCount} produto(s) publicado(s)!`);
        
        // Update last_run_at
        await supabase
          .from('scheduled_batch_imports')
          .update({ 
            last_run_at: new Date().toISOString(),
            next_run_at: calculateNextRunAt()
          })
          .eq('id', schedule.id);

        fetchSchedules();
        fetchLogs();
      }
    } catch (err) {
      console.error("Error running schedule:", err);
      toast.error("Erro ao executar importação");
    } finally {
      setRunningScheduleId(null);
    }
  };

  const resetForm = () => {
    setName("");
    setUrlsText("");
    setFrequency("daily");
    setHourOfDay(9);
    setDayOfWeek(1);
    setDayOfMonth(1);
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Diário';
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensal';
      default: return freq;
    }
  };

  const getDayOfWeekLabel = (day: number) => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[day] || '';
  };

  if (loading) {
    return (
      <Card variant="glass">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glass" className="animate-fade-in overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Importação Agendada</CardTitle>
              <CardDescription>Configure importações automáticas</CardDescription>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
                <DialogDescription>
                  Configure uma importação em lote automática
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nome do agendamento</Label>
                  <Input
                    placeholder="Ex: Importação diária"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>URLs dos produtos (até 20)</Label>
                  <Textarea
                    placeholder="Cole as URLs dos produtos, uma por linha..."
                    className="min-h-[120px] font-mono text-sm"
                    value={urlsText}
                    onChange={(e) => setUrlsText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {parseUrls(urlsText).length} URL(s) válida(s)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
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

                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Select value={hourOfDay.toString()} onValueChange={(v) => setHourOfDay(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Dia da semana</Label>
                    <Select value={dayOfWeek.toString()} onValueChange={(v) => setDayOfWeek(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Domingo</SelectItem>
                        <SelectItem value="1">Segunda-feira</SelectItem>
                        <SelectItem value="2">Terça-feira</SelectItem>
                        <SelectItem value="3">Quarta-feira</SelectItem>
                        <SelectItem value="4">Quinta-feira</SelectItem>
                        <SelectItem value="5">Sexta-feira</SelectItem>
                        <SelectItem value="6">Sábado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {frequency === 'monthly' && (
                  <div className="space-y-2">
                    <Label>Dia do mês</Label>
                    <Select value={dayOfMonth.toString()} onValueChange={(v) => setDayOfMonth(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            Dia {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button className="w-full" onClick={handleCreateSchedule}>
                  Criar Agendamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {schedules.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum agendamento configurado</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{schedule.name}</span>
                      <Badge variant={schedule.is_active ? "success" : "outline"}>
                        {schedule.is_active ? "Ativo" : "Pausado"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{getFrequencyLabel(schedule.frequency)}</span>
                      <span>•</span>
                      <span>{schedule.hour_of_day.toString().padStart(2, '0')}:00</span>
                      {schedule.frequency === 'weekly' && schedule.day_of_week !== null && (
                        <>
                          <span>•</span>
                          <span>{getDayOfWeekLabel(schedule.day_of_week)}</span>
                        </>
                      )}
                      {schedule.frequency === 'monthly' && schedule.day_of_month !== null && (
                        <>
                          <span>•</span>
                          <span>Dia {schedule.day_of_month}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {schedule.urls.length} URL(s)
                      {schedule.next_run_at && schedule.is_active && (
                        <> • Próxima: {formatDistanceToNow(new Date(schedule.next_run_at), { addSuffix: true, locale: ptBR })}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={schedule.is_active}
                      onCheckedChange={() => handleToggleActive(schedule.id, schedule.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRunNow(schedule)}
                      disabled={runningScheduleId === schedule.id}
                    >
                      {runningScheduleId === schedule.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Recent Logs */}
        {logs.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Execuções Recentes
            </h4>
            <ScrollArea className="h-[120px]">
              <div className="space-y-2">
                {logs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-xs p-2 rounded bg-muted/20"
                  >
                    <div className="flex items-center gap-2">
                      {log.status === 'success' || log.status === 'complete' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : log.status === 'error' ? (
                        <XCircle className="h-3 w-3 text-destructive" />
                      ) : (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      <span className="text-muted-foreground">
                        {format(new Date(log.started_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">{log.success_count}✓</span>
                      <span className="text-destructive">{log.failed_count}✗</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
