import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
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
  Target,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Bell,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface Goal {
  id: string;
  metric_key: string;
  metric_name: string;
  target_value: number;
  comparison_operator: string;
  is_active: boolean;
}

interface GoalsManagerProps {
  userId: string;
  products: Product[];
}

const AVAILABLE_METRICS = [
  { key: "publish_rate", name: "Taxa de Publicação (%)", defaultTarget: 80 },
  { key: "total_views", name: "Total de Visualizações", defaultTarget: 1000 },
  { key: "total_sales", name: "Total de Vendas", defaultTarget: 50 },
  { key: "conversion_rate", name: "Taxa de Conversão (%)", defaultTarget: 2 },
  { key: "avg_views_per_product", name: "Média Views/Produto", defaultTarget: 100 },
  { key: "ai_optimization_rate", name: "Taxa de Otimização IA (%)", defaultTarget: 70 },
  { key: "error_rate", name: "Taxa de Erros (%)", defaultTarget: 5 },
  { key: "total_revenue", name: "Receita Total (R$)", defaultTarget: 5000 },
];

const OPERATORS = [
  { value: "gte", label: "≥ (maior ou igual)" },
  { value: "lte", label: "≤ (menor ou igual)" },
  { value: "gt", label: "> (maior que)" },
  { value: "lt", label: "< (menor que)" },
];

export function GoalsManager({ userId, products }: GoalsManagerProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    metric_key: "",
    target_value: 0,
    comparison_operator: "gte",
  });

  // Fetch goals
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["user-goals", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_goals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!userId,
  });

  // Calculate current metrics
  const currentMetrics = useMemo(() => {
    const total = products.length;
    const published = products.filter((p) => p.status === "published").length;
    const errors = products.filter((p) => p.status === "error").length;
    const aiOptimized = products.filter((p) => p.ai_optimized).length;
    const totalViews = products.reduce((acc, p) => acc + (p.views || 0), 0);
    const totalSales = products.reduce((acc, p) => acc + (p.sales || 0), 0);
    const totalRevenue = products.reduce(
      (acc, p) => acc + (p.sales || 0) * (p.price || 0),
      0
    );

    return {
      publish_rate: total > 0 ? (published / total) * 100 : 0,
      total_views: totalViews,
      total_sales: totalSales,
      conversion_rate: totalViews > 0 ? (totalSales / totalViews) * 100 : 0,
      avg_views_per_product: published > 0 ? totalViews / published : 0,
      ai_optimization_rate: total > 0 ? (aiOptimized / total) * 100 : 0,
      error_rate: total > 0 ? (errors / total) * 100 : 0,
      total_revenue: totalRevenue,
    };
  }, [products]);

  // Add goal mutation
  const addGoalMutation = useMutation({
    mutationFn: async (goal: typeof newGoal) => {
      const metric = AVAILABLE_METRICS.find((m) => m.key === goal.metric_key);
      if (!metric) throw new Error("Métrica inválida");

      const { error } = await supabase.from("user_goals").insert({
        user_id: userId,
        metric_key: goal.metric_key,
        metric_name: metric.name,
        target_value: goal.target_value,
        comparison_operator: goal.comparison_operator,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-goals", userId] });
      setIsDialogOpen(false);
      setNewGoal({ metric_key: "", target_value: 0, comparison_operator: "gte" });
      toast.success("Meta criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar meta", { description: error.message });
    },
  });

  // Toggle goal mutation
  const toggleGoalMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("user_goals")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-goals", userId] });
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-goals", userId] });
      toast.success("Meta removida");
    },
  });

  // Check goal status
  const checkGoalStatus = (goal: Goal) => {
    const currentValue = currentMetrics[goal.metric_key as keyof typeof currentMetrics] || 0;
    const target = Number(goal.target_value);

    let isMet = false;
    switch (goal.comparison_operator) {
      case "gte":
        isMet = currentValue >= target;
        break;
      case "lte":
        isMet = currentValue <= target;
        break;
      case "gt":
        isMet = currentValue > target;
        break;
      case "lt":
        isMet = currentValue < target;
        break;
      default:
        isMet = currentValue >= target;
    }

    const progress = goal.comparison_operator.includes("lt")
      ? target > 0
        ? Math.max(0, Math.min(100, ((target - currentValue) / target) * 100))
        : 0
      : target > 0
      ? Math.min(100, (currentValue / target) * 100)
      : 0;

    return { currentValue, isMet, progress };
  };

  const handleAddGoal = () => {
    if (!newGoal.metric_key || newGoal.target_value <= 0) {
      toast.error("Preencha todos os campos");
      return;
    }
    addGoalMutation.mutate(newGoal);
  };

  const handleMetricChange = (key: string) => {
    const metric = AVAILABLE_METRICS.find((m) => m.key === key);
    setNewGoal({
      ...newGoal,
      metric_key: key,
      target_value: metric?.defaultTarget || 0,
      comparison_operator: key === "error_rate" ? "lte" : "gte",
    });
  };

  // Available metrics for new goals
  const availableForNewGoal = AVAILABLE_METRICS.filter(
    (m) => !goals.some((g) => g.metric_key === m.key)
  );

  // Goals with alerts (not meeting target)
  const alertGoals = goals.filter((g) => g.is_active && !checkGoalStatus(g).isMet);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {alertGoals.length > 0 && (
        <Card variant="glass" className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium text-orange-600">
                  {alertGoals.length} meta{alertGoals.length > 1 ? "s" : ""} abaixo do esperado
                </p>
                <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                  {alertGoals.slice(0, 3).map((goal) => {
                    const { currentValue } = checkGoalStatus(goal);
                    return (
                      <li key={goal.id}>
                        • {goal.metric_name}: {currentValue.toFixed(1)} (meta: {Number(goal.target_value)})
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Metas e Alertas
          </h3>
          <p className="text-sm text-muted-foreground">
            Defina metas para suas métricas e receba alertas
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={availableForNewGoal.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Meta</DialogTitle>
              <DialogDescription>
                Defina uma meta para monitorar suas métricas de performance
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Métrica</Label>
                <Select
                  value={newGoal.metric_key}
                  onValueChange={handleMetricChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma métrica" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableForNewGoal.map((metric) => (
                      <SelectItem key={metric.key} value={metric.key}>
                        {metric.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Operador</Label>
                  <Select
                    value={newGoal.comparison_operator}
                    onValueChange={(v) =>
                      setNewGoal({ ...newGoal, comparison_operator: v })
                    }
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

                <div className="space-y-2">
                  <Label>Valor Alvo</Label>
                  <Input
                    type="number"
                    value={newGoal.target_value}
                    onChange={(e) =>
                      setNewGoal({
                        ...newGoal,
                        target_value: Number(e.target.value),
                      })
                    }
                    min={0}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleAddGoal}
                disabled={addGoalMutation.isPending}
              >
                {addGoalMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Criar Meta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Goals List */}
      {goals.length === 0 ? (
        <Card variant="glass">
          <CardContent className="py-8 text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma meta configurada</p>
            <p className="text-sm text-muted-foreground">
              Crie metas para monitorar a performance dos seus produtos
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const { currentValue, isMet, progress } = checkGoalStatus(goal);
            const operatorSymbol =
              goal.comparison_operator === "gte"
                ? "≥"
                : goal.comparison_operator === "lte"
                ? "≤"
                : goal.comparison_operator === "gt"
                ? ">"
                : "<";

            return (
              <Card
                key={goal.id}
                variant="glass"
                className={`transition-all ${
                  !goal.is_active ? "opacity-50" : ""
                } ${!isMet && goal.is_active ? "border-orange-500/30" : ""}`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{goal.metric_name}</span>
                        {goal.is_active &&
                          (isMet ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Meta: {operatorSymbol} {Number(goal.target_value).toLocaleString("pt-BR")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={goal.is_active}
                        onCheckedChange={(checked) =>
                          toggleGoalMutation.mutate({
                            id: goal.id,
                            is_active: checked,
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteGoalMutation.mutate(goal.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Atual:</span>
                      <span
                        className={`font-bold ${
                          isMet ? "text-green-500" : "text-orange-500"
                        }`}
                      >
                        {currentValue.toLocaleString("pt-BR", {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <Progress
                      value={progress}
                      className={`h-2 ${!isMet ? "[&>div]:bg-orange-500" : ""}`}
                    />

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{progress.toFixed(0)}% da meta</span>
                      {isMet ? (
                        <Badge variant="success" className="text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Atingida
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="text-xs">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Abaixo
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
