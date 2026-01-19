import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, addDays, addWeeks, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ScheduleConfig {
  frequency: "daily" | "weekly";
  hourOfDay: number;
  dayOfWeek: number | null;
  isActive: boolean;
}

export function SupplierRescrapeScheduler() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ScheduleConfig>({
    frequency: "daily",
    hourOfDay: 6,
    dayOfWeek: 1, // Monday
    isActive: false,
  });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [nextRun, setNextRun] = useState<Date | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchSchedule = async () => {
      const { data, error } = await supabase
        .from("scheduled_tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("task_type", "supplier_rescrape")
        .single();

      if (data) {
        setTaskId(data.id);
        setConfig({
          frequency: data.frequency as "daily" | "weekly",
          hourOfDay: data.hour_of_day,
          dayOfWeek: data.day_of_week,
          isActive: data.is_active,
        });
        if (data.next_run_at) setNextRun(new Date(data.next_run_at));
        if (data.last_run_at) setLastRun(new Date(data.last_run_at));
      }
      setIsLoading(false);
    };

    fetchSchedule();
  }, [user?.id]);

  const calculateNextRun = (cfg: ScheduleConfig): Date => {
    const now = new Date();
    let next = setMinutes(setHours(now, cfg.hourOfDay), 0);

    if (cfg.frequency === "daily") {
      if (next <= now) {
        next = addDays(next, 1);
      }
    } else if (cfg.frequency === "weekly" && cfg.dayOfWeek !== null) {
      const currentDay = now.getDay();
      const targetDay = cfg.dayOfWeek;
      let daysUntil = targetDay - currentDay;
      
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
      }
      
      next = addDays(setMinutes(setHours(now, cfg.hourOfDay), 0), daysUntil);
    }

    return next;
  };

  const handleSave = async () => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      const nextRunAt = calculateNextRun(config);

      const taskData = {
        user_id: user.id,
        task_type: "supplier_rescrape",
        frequency: config.frequency,
        hour_of_day: config.hourOfDay,
        day_of_week: config.frequency === "weekly" ? config.dayOfWeek : null,
        is_active: config.isActive,
        next_run_at: config.isActive ? nextRunAt.toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (taskId) {
        const { error } = await supabase
          .from("scheduled_tasks")
          .update(taskData)
          .eq("id", taskId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("scheduled_tasks")
          .insert(taskData)
          .select("id")
          .single();
        if (error) throw error;
        if (data) setTaskId(data.id);
      }

      setNextRun(config.isActive ? nextRunAt : null);
      toast.success("Agendamento salvo com sucesso!");
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Erro ao salvar agendamento");
    } finally {
      setIsSaving(false);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const daysOfWeek = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Segunda-feira" },
    { value: 2, label: "Terça-feira" },
    { value: 3, label: "Quarta-feira" },
    { value: 4, label: "Quinta-feira" },
    { value: 5, label: "Sexta-feira" },
    { value: 6, label: "Sábado" },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Agendamento Automático de Re-scraping
        </CardTitle>
        <CardDescription>
          Configure quando o sistema deve verificar automaticamente os preços do fornecedor
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">
              Agendamento Ativo
            </Label>
            <p className="text-sm text-muted-foreground">
              Executar verificação de preços automaticamente
            </p>
          </div>
          <Switch
            checked={config.isActive}
            onCheckedChange={(checked) => 
              setConfig(prev => ({ ...prev, isActive: checked }))
            }
          />
        </div>

        {config.isActive && (
          <>
            {/* Next/Last Run Info */}
            <div className="grid gap-4 md:grid-cols-2">
              {nextRun && (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-primary/5">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Próxima Execução</p>
                    <p className="text-sm text-muted-foreground">
                      {format(nextRun, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}
              {lastRun && (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Última Execução</p>
                    <p className="text-sm text-muted-foreground">
                      {format(lastRun, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Frequency Configuration */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Frequência</Label>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select
                    value={config.frequency}
                    onValueChange={(value: "daily" | "weekly") => 
                      setConfig(prev => ({ ...prev, frequency: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diariamente</SelectItem>
                      <SelectItem value="weekly">Semanalmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.frequency === "weekly" && (
                  <div className="space-y-2">
                    <Label>Dia da Semana</Label>
                    <Select
                      value={config.dayOfWeek?.toString() ?? "1"}
                      onValueChange={(value) => 
                        setConfig(prev => ({ ...prev, dayOfWeek: parseInt(value) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {daysOfWeek.map(day => (
                          <SelectItem key={day.value} value={day.value.toString()}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Select
                    value={config.hourOfDay.toString()}
                    onValueChange={(value) => 
                      setConfig(prev => ({ ...prev, hourOfDay: parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hours.map(hour => (
                        <SelectItem key={hour} value={hour.toString()}>
                          {hour.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Resumo:</strong>{" "}
                {config.frequency === "daily" 
                  ? `Verificar preços todos os dias às ${config.hourOfDay.toString().padStart(2, "0")}:00`
                  : `Verificar preços toda ${daysOfWeek.find(d => d.value === config.dayOfWeek)?.label || ""} às ${config.hourOfDay.toString().padStart(2, "0")}:00`
                }
              </p>
            </div>
          </>
        )}

        {!config.isActive && (
          <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              O agendamento está desativado. Ative para verificar preços automaticamente.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Agendamento
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
