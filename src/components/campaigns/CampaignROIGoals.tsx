import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Target, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  DollarSign,
  Percent,
  Users,
  Bell,
  BellOff
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CampaignHistory {
  id: string;
  campaign_type: string;
  recipients_count: number;
  converted_count: number;
  created_at: string;
}

interface CampaignROIGoalsProps {
  userId: string;
  campaigns: CampaignHistory[];
  averageOrderValue?: number;
}

interface Goal {
  id: string;
  user_id: string;
  metric_key: string;
  metric_name: string;
  target_value: number;
  comparison_operator: string;
  is_active: boolean;
  created_at: string;
}

const CAMPAIGN_METRICS = [
  { key: "conversion_rate", name: "Taxa de Conversão (%)", icon: Percent, defaultTarget: 5 },
  { key: "monthly_revenue", name: "Receita Mensal (R$)", icon: DollarSign, defaultTarget: 10000 },
  { key: "monthly_conversions", name: "Conversões Mensais", icon: Users, defaultTarget: 50 },
  { key: "campaign_roi", name: "ROI das Campanhas (%)", icon: TrendingUp, defaultTarget: 200 },
];

const OPERATORS = [
  { value: "gte", label: "≥ Maior ou igual" },
  { value: "lte", label: "≤ Menor ou igual" },
  { value: "gt", label: "> Maior que" },
  { value: "lt", label: "< Menor que" },
];

export function CampaignROIGoals({ 
  userId, 
  campaigns,
  averageOrderValue = 150 
}: CampaignROIGoalsProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    metric_key: CAMPAIGN_METRICS[0].key,
    target_value: CAMPAIGN_METRICS[0].defaultTarget,
    comparison_operator: "gte",
  });

  // Calculate current metrics from campaigns
  const currentMetrics = useMemo(() => {
    const reactivationCampaigns = campaigns.filter(c => c.campaign_type === "reactivation");
    const totalRecipients = reactivationCampaigns.reduce((sum, c) => sum + c.recipients_count, 0);
    const totalConverted = reactivationCampaigns.reduce((sum, c) => sum + c.converted_count, 0);
    
    const conversionRate = totalRecipients > 0 ? (totalConverted / totalRecipients) * 100 : 0;
    const totalRevenue = totalConverted * averageOrderValue;
    const campaignCost = totalRecipients * 5; // Cost per contact
    const roi = campaignCost > 0 ? ((totalRevenue - campaignCost) / campaignCost) * 100 : 0;

    // Get last 30 days campaigns
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentCampaigns = reactivationCampaigns.filter(c => 
      new Date(c.created_at) >= thirtyDaysAgo
    );
    const recentConverted = recentCampaigns.reduce((sum, c) => sum + c.converted_count, 0);
    const recentRevenue = recentConverted * averageOrderValue;

    return {
      conversion_rate: conversionRate,
      monthly_revenue: recentRevenue,
      monthly_conversions: recentConverted,
      campaign_roi: roi,
    };
  }, [campaigns, averageOrderValue]);

  // Fetch goals
  const { data: goals, isLoading } = useQuery({
    queryKey: ["campaign-roi-goals", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_goals")
        .select("*")
        .eq("user_id", userId)
        .in("metric_key", CAMPAIGN_METRICS.map(m => m.key))
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!userId,
  });

  // Add goal mutation
  const addGoalMutation = useMutation({
    mutationFn: async (goal: typeof newGoal) => {
      const metricInfo = CAMPAIGN_METRICS.find(m => m.key === goal.metric_key);
      
      const { error } = await supabase.from("user_goals").insert({
        user_id: userId,
        metric_key: goal.metric_key,
        metric_name: metricInfo?.name || goal.metric_key,
        target_value: goal.target_value,
        comparison_operator: goal.comparison_operator,
        is_active: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta criada com sucesso!");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["campaign-roi-goals"] });
      setNewGoal({
        metric_key: CAMPAIGN_METRICS[0].key,
        target_value: CAMPAIGN_METRICS[0].defaultTarget,
        comparison_operator: "gte",
      });
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast.error("Já existe uma meta para esta métrica");
      } else {
        toast.error(err.message || "Erro ao criar meta");
      }
    },
  });

  // Toggle goal mutation
  const toggleGoalMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("user_goals")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-roi-goals"] });
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_goals")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["campaign-roi-goals"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir meta");
    },
  });

  // Check goal status
  const checkGoalStatus = (goal: Goal) => {
    const currentValue = currentMetrics[goal.metric_key as keyof typeof currentMetrics] || 0;
    let isMet = false;

    switch (goal.comparison_operator) {
      case "gte":
        isMet = currentValue >= goal.target_value;
        break;
      case "lte":
        isMet = currentValue <= goal.target_value;
        break;
      case "gt":
        isMet = currentValue > goal.target_value;
        break;
      case "lt":
        isMet = currentValue < goal.target_value;
        break;
    }

    const progress = goal.comparison_operator.includes("g")
      ? Math.min((currentValue / goal.target_value) * 100, 100)
      : Math.min((goal.target_value / currentValue) * 100, 100);

    return { isMet, currentValue, progress: isNaN(progress) ? 0 : progress };
  };

  const formatValue = (key: string, value: number) => {
    if (key === "monthly_revenue") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }
    if (key.includes("rate") || key.includes("roi")) {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString();
  };

  const getMetricIcon = (key: string) => {
    const metric = CAMPAIGN_METRICS.find(m => m.key === key);
    return metric?.icon || Target;
  };

  // Active goals that are not met (for alerts)
  const unmetActiveGoals = useMemo(() => {
    if (!goals) return [];
    return goals
      .filter(g => g.is_active)
      .map(g => ({ ...g, ...checkGoalStatus(g) }))
      .filter(g => !g.isMet);
  }, [goals, currentMetrics]);

  // Met goals (for celebration)
  const metActiveGoals = useMemo(() => {
    if (!goals) return [];
    return goals
      .filter(g => g.is_active)
      .map(g => ({ ...g, ...checkGoalStatus(g) }))
      .filter(g => g.isMet);
  }, [goals, currentMetrics]);

  return (
    <div className="space-y-6">
      {/* Alerts for unmet goals */}
      {unmetActiveGoals.length > 0 && (
        <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Metas não atingidas</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {unmetActiveGoals.map(goal => (
                <li key={goal.id} className="flex items-center gap-2">
                  <span className="font-medium">{goal.metric_name}:</span>
                  <span>Atual: {formatValue(goal.metric_key, goal.currentValue)}</span>
                  <span className="text-muted-foreground">|</span>
                  <span>Meta: {formatValue(goal.metric_key, goal.target_value)}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Success for met goals */}
      {metActiveGoals.length > 0 && unmetActiveGoals.length === 0 && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-700 dark:text-green-400">Todas as metas atingidas! 🎉</AlertTitle>
          <AlertDescription className="text-green-600 dark:text-green-500">
            Parabéns! Você atingiu todas as suas metas de ROI de campanhas.
          </AlertDescription>
        </Alert>
      )}

      {/* Goals Management Card */}
      <Card className="glass border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Metas de ROI
              </CardTitle>
              <CardDescription>
                Configure metas para suas campanhas e receba alertas
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Meta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Meta</DialogTitle>
                  <DialogDescription>
                    Defina uma meta para acompanhar a performance das suas campanhas.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Métrica</Label>
                    <Select
                      value={newGoal.metric_key}
                      onValueChange={(v) => {
                        const metric = CAMPAIGN_METRICS.find(m => m.key === v);
                        setNewGoal({ 
                          ...newGoal, 
                          metric_key: v,
                          target_value: metric?.defaultTarget || 0 
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CAMPAIGN_METRICS.map((metric) => (
                          <SelectItem key={metric.key} value={metric.key}>
                            <div className="flex items-center gap-2">
                              <metric.icon className="h-4 w-4 text-muted-foreground" />
                              {metric.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Operador</Label>
                    <Select
                      value={newGoal.comparison_operator}
                      onValueChange={(v) => setNewGoal({ ...newGoal, comparison_operator: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Valor Alvo</Label>
                    <Input
                      type="number"
                      value={newGoal.target_value}
                      onChange={(e) => setNewGoal({ ...newGoal, target_value: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Valor atual: {formatValue(newGoal.metric_key, currentMetrics[newGoal.metric_key as keyof typeof currentMetrics] || 0)}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => addGoalMutation.mutate(newGoal)}
                    disabled={addGoalMutation.isPending}
                  >
                    {addGoalMutation.isPending ? "Criando..." : "Criar Meta"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : goals?.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma meta configurada.</p>
              <p className="text-sm text-muted-foreground">Crie metas para acompanhar o ROI das suas campanhas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {goals?.map((goal) => {
                const { isMet, currentValue, progress } = checkGoalStatus(goal);
                const Icon = getMetricIcon(goal.metric_key);
                const operator = OPERATORS.find(o => o.value === goal.comparison_operator);

                return (
                  <div
                    key={goal.id}
                    className={`p-4 rounded-lg border transition-all ${
                      isMet 
                        ? "border-green-500/30 bg-green-500/5" 
                        : goal.is_active 
                          ? "border-orange-500/30 bg-orange-500/5" 
                          : "border-border/50 bg-muted/10 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          isMet ? "bg-green-500/10" : goal.is_active ? "bg-orange-500/10" : "bg-muted/30"
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            isMet ? "text-green-500" : goal.is_active ? "text-orange-500" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {goal.metric_name}
                            {isMet && goal.is_active && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {operator?.label.split(" ")[0]} {formatValue(goal.metric_key, goal.target_value)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={goal.is_active}
                          onCheckedChange={(checked) => 
                            toggleGoalMutation.mutate({ id: goal.id, isActive: checked })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteGoalMutation.mutate(goal.id)}
                          disabled={deleteGoalMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">
                          {formatValue(goal.metric_key, currentValue)} / {formatValue(goal.metric_key, goal.target_value)}
                        </span>
                      </div>
                      <Progress 
                        value={progress} 
                        className={`h-2 ${isMet ? "[&>div]:bg-green-500" : goal.is_active ? "[&>div]:bg-orange-500" : ""}`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{progress.toFixed(0)}% do objetivo</span>
                        {!isMet && goal.is_active && (
                          <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-600">
                            Faltam {formatValue(goal.metric_key, Math.max(0, goal.target_value - currentValue))}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Metrics Overview */}
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle>Métricas Atuais</CardTitle>
          <CardDescription>Valores atuais das métricas disponíveis para metas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {CAMPAIGN_METRICS.map((metric) => {
              const value = currentMetrics[metric.key as keyof typeof currentMetrics];
              const hasGoal = goals?.some(g => g.metric_key === metric.key);
              
              return (
                <div key={metric.key} className="p-4 rounded-lg border border-border/50 bg-muted/10">
                  <div className="flex items-center gap-2 mb-2">
                    <metric.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{metric.name}</span>
                  </div>
                  <p className="text-2xl font-bold">{formatValue(metric.key, value)}</p>
                  {hasGoal && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      Meta configurada
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
