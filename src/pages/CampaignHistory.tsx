import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { RefreshCw, Send, Bell, Calendar, Clock, Plus, Trash2, History, TrendingUp, Users, Package } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignHistory {
  id: string;
  user_id: string;
  campaign_type: string;
  status: string;
  recipients_count: number;
  converted_count: number;
  details: Record<string, any> | null;
  created_at: string;
}

interface ScheduledTask {
  id: string;
  user_id: string;
  task_type: string;
  is_active: boolean;
  frequency: string;
  hour_of_day: number;
  day_of_week: number | null;
  day_of_month: number | null;
  config: Record<string, any> | null;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function CampaignHistoryPage() {
  const { loading: authLoading, session } = useRequireAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    task_type: "reactivation",
    frequency: "daily",
    hour_of_day: 9,
    day_of_week: 1,
    day_of_month: 1,
    inactive_days: 30,
    critical_days: 7,
    alert_email: "",
  });

  // Set email when session loads
  useState(() => {
    if (session?.user?.email) {
      setNewTask(prev => ({ ...prev, alert_email: session.user.email || "" }));
    }
  });

  // Fetch campaign history
  const { data: campaigns, isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery({
    queryKey: ["campaign-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as CampaignHistory[];
    },
    enabled: !!session?.user,
  });

  // Fetch scheduled tasks
  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ["scheduled-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ScheduledTask[];
    },
    enabled: !!session?.user,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (task: typeof newTask) => {
      // Calculate next run
      const nextRun = new Date();
      nextRun.setHours(task.hour_of_day, 0, 0, 0);
      if (nextRun <= new Date()) {
        if (task.frequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
        else if (task.frequency === "weekly") nextRun.setDate(nextRun.getDate() + (7 - nextRun.getDay() + task.day_of_week) % 7 || 7);
        else if (task.frequency === "monthly") nextRun.setMonth(nextRun.getMonth() + 1);
      }

      const { error } = await supabase.from("scheduled_tasks").insert({
        user_id: session!.user.id,
        task_type: task.task_type,
        frequency: task.frequency,
        hour_of_day: task.hour_of_day,
        day_of_week: task.frequency === "weekly" ? task.day_of_week : null,
        day_of_month: task.frequency === "monthly" ? task.day_of_month : null,
        next_run_at: nextRun.toISOString(),
        config: task.task_type === "reactivation"
          ? { inactive_days: task.inactive_days }
          : { critical_days: task.critical_days, alert_email: task.alert_email },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa agendada criada com sucesso!");
      setCreateDialogOpen(false);
      refetchTasks();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar tarefa");
    },
  });

  // Toggle task mutation
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("scheduled_tasks")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchTasks();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar tarefa");
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduled_tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa excluída com sucesso!");
      refetchTasks();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir tarefa");
    },
  });

  // Stats
  const stats = {
    totalCampaigns: campaigns?.length || 0,
    reactivationCampaigns: campaigns?.filter(c => c.campaign_type === "reactivation").length || 0,
    stockAlerts: campaigns?.filter(c => c.campaign_type === "stock_alert").length || 0,
    totalRecipients: campaigns?.reduce((sum, c) => sum + c.recipients_count, 0) || 0,
  };

  if (authLoading) {
    return (
      <DashboardLayout title="Histórico de Campanhas" subtitle="Carregando...">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Histórico de Campanhas"
      subtitle="Histórico e agendamento de campanhas de reativação e alertas de estoque"
    >
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <History className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Total de Campanhas</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalCampaigns}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <p className="text-sm text-muted-foreground">Reativações</p>
            </div>
            <p className="text-2xl font-bold">{stats.reactivationCampaigns}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-orange-500" />
              <p className="text-sm text-muted-foreground">Alertas de Estoque</p>
            </div>
            <p className="text-2xl font-bold">{stats.stockAlerts}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <p className="text-sm text-muted-foreground">Total de Destinatários</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalRecipients}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Agendamentos
          </TabsTrigger>
        </TabsList>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className="glass border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico de Campanhas</CardTitle>
                  <CardDescription>Todas as campanhas enviadas e seus resultados</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchCampaigns()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : campaigns?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma campanha enviada ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Destinatários</TableHead>
                        <TableHead className="text-center">Convertidos</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns?.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {campaign.campaign_type === "reactivation" ? (
                                <Send className="h-4 w-4 text-blue-500" />
                              ) : (
                                <Bell className="h-4 w-4 text-orange-500" />
                              )}
                              <span>
                                {campaign.campaign_type === "reactivation" ? "Reativação" : "Alerta Estoque"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={campaign.status === "sent" ? "default" : "secondary"}>
                              {campaign.status === "sent" ? "Enviado" : campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{campaign.recipients_count}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-green-600 font-medium">{campaign.converted_count}</span>
                            {campaign.recipients_count > 0 && (
                              <span className="text-muted-foreground text-sm ml-1">
                                ({((campaign.converted_count / campaign.recipients_count) * 100).toFixed(0)}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="text-sm text-muted-foreground truncate">
                              {campaign.details && typeof campaign.details === "object"
                                ? Object.entries(campaign.details)
                                    .slice(0, 2)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(", ")
                                : "—"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">
                              {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(campaign.created_at), { locale: ptBR, addSuffix: true })}
                            </p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Tasks Tab */}
        <TabsContent value="scheduled">
          <Card className="glass border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tarefas Agendadas</CardTitle>
                  <CardDescription>Configure envios automáticos periódicos</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => refetchTasks()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </Button>
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Tarefa
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Tarefa Agendada</DialogTitle>
                        <DialogDescription>
                          Configure uma tarefa para ser executada automaticamente.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Tipo de Tarefa</Label>
                          <Select
                            value={newTask.task_type}
                            onValueChange={(v) => setNewTask({ ...newTask, task_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="reactivation">Campanha de Reativação</SelectItem>
                              <SelectItem value="stock_alert">Alerta de Estoque</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Frequência</Label>
                          <Select
                            value={newTask.frequency}
                            onValueChange={(v) => setNewTask({ ...newTask, frequency: v })}
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

                        <div>
                          <Label>Horário (hora do dia)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={23}
                            value={newTask.hour_of_day}
                            onChange={(e) => setNewTask({ ...newTask, hour_of_day: Number(e.target.value) })}
                          />
                        </div>

                        {newTask.frequency === "weekly" && (
                          <div>
                            <Label>Dia da Semana</Label>
                            <Select
                              value={String(newTask.day_of_week)}
                              onValueChange={(v) => setNewTask({ ...newTask, day_of_week: Number(v) })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DAY_LABELS.map((day, i) => (
                                  <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {newTask.frequency === "monthly" && (
                          <div>
                            <Label>Dia do Mês</Label>
                            <Input
                              type="number"
                              min={1}
                              max={28}
                              value={newTask.day_of_month}
                              onChange={(e) => setNewTask({ ...newTask, day_of_month: Number(e.target.value) })}
                            />
                          </div>
                        )}

                        {newTask.task_type === "reactivation" && (
                          <div>
                            <Label>Clientes inativos há mais de (dias)</Label>
                            <Input
                              type="number"
                              min={7}
                              value={newTask.inactive_days}
                              onChange={(e) => setNewTask({ ...newTask, inactive_days: Number(e.target.value) })}
                            />
                          </div>
                        )}

                        {newTask.task_type === "stock_alert" && (
                          <>
                            <div>
                              <Label>Estoque crítico (menos de X dias)</Label>
                              <Input
                                type="number"
                                min={1}
                                value={newTask.critical_days}
                                onChange={(e) => setNewTask({ ...newTask, critical_days: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <Label>E-mail para alertas</Label>
                              <Input
                                type="email"
                                value={newTask.alert_email}
                                onChange={(e) => setNewTask({ ...newTask, alert_email: e.target.value })}
                                placeholder="seu@email.com"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => createTaskMutation.mutate(newTask)}
                          disabled={createTaskMutation.isPending}
                        >
                          {createTaskMutation.isPending ? "Criando..." : "Criar Tarefa"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : tasks?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma tarefa agendada. Crie uma nova tarefa para começar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ativo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Frequência</TableHead>
                        <TableHead>Próxima Execução</TableHead>
                        <TableHead>Última Execução</TableHead>
                        <TableHead>Configuração</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks?.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <Switch
                              checked={task.is_active}
                              onCheckedChange={(checked) => toggleTaskMutation.mutate({ id: task.id, isActive: checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {task.task_type === "reactivation" ? (
                                <Send className="h-4 w-4 text-blue-500" />
                              ) : (
                                <Bell className="h-4 w-4 text-orange-500" />
                              )}
                              <span>
                                {task.task_type === "reactivation" ? "Reativação" : "Alerta Estoque"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{FREQUENCY_LABELS[task.frequency] || task.frequency}</span>
                              <span className="text-muted-foreground">às {task.hour_of_day}h</span>
                            </div>
                            {task.frequency === "weekly" && task.day_of_week !== null && (
                              <p className="text-xs text-muted-foreground">{DAY_LABELS[task.day_of_week]}</p>
                            )}
                            {task.frequency === "monthly" && task.day_of_month !== null && (
                              <p className="text-xs text-muted-foreground">Dia {task.day_of_month}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {task.next_run_at ? (
                              <>
                                <p className="text-sm">
                                  {format(new Date(task.next_run_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(task.next_run_at), { locale: ptBR, addSuffix: true })}
                                </p>
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {task.last_run_at ? (
                              <p className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(task.last_run_at), { locale: ptBR, addSuffix: true })}
                              </p>
                            ) : (
                              <span className="text-muted-foreground">Nunca</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[150px]">
                            <p className="text-sm text-muted-foreground truncate">
                              {task.config && typeof task.config === "object"
                                ? Object.entries(task.config)
                                    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                                    .join(", ")
                                : "—"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTaskMutation.mutate(task.id)}
                              disabled={deleteTaskMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
