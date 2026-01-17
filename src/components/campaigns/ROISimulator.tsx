import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Calculator, TrendingUp, Plus, Trash2, Save, Target, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface ROISimulatorProps {
  currentConversionRate: number;
  currentAverageTicket: number;
  currentRecipients: number;
  campaignCost: number;
  onScenariosChange?: (scenarios: SimulatorScenario[]) => void;
}

export interface SimulatorScenario {
  id: string;
  name: string;
  conversionRate: number;
  averageTicket: number;
  projectedRevenue: number;
  projectedROI: number;
  projectedConversions: number;
  projectedCost: number;
  projectedProfit: number;
}

export function ROISimulator({
  currentConversionRate,
  currentAverageTicket,
  currentRecipients,
  campaignCost,
  onScenariosChange,
}: ROISimulatorProps) {
  const [scenarios, setScenarios] = useState<SimulatorScenario[]>([
    {
      id: "current",
      name: "Atual",
      conversionRate: currentConversionRate,
      averageTicket: currentAverageTicket,
      projectedRevenue: 0,
      projectedROI: 0,
      projectedConversions: 0,
      projectedCost: 0,
      projectedProfit: 0,
    },
  ]);

  const [newScenario, setNewScenario] = useState({
    name: "",
    conversionRate: currentConversionRate * 1.2,
    averageTicket: currentAverageTicket * 1.1,
  });

  const [simulatorRecipients, setSimulatorRecipients] = useState(currentRecipients || 1000);

  // Calculate projections for all scenarios
  const calculatedScenarios = useMemo(() => {
    return scenarios.map((scenario) => {
      const projectedConversions = Math.round(simulatorRecipients * (scenario.conversionRate / 100));
      const projectedRevenue = projectedConversions * scenario.averageTicket;
      const projectedCost = simulatorRecipients * campaignCost;
      const projectedProfit = projectedRevenue - projectedCost;
      const projectedROI = projectedCost > 0 ? ((projectedRevenue - projectedCost) / projectedCost) * 100 : 0;

      return {
        ...scenario,
        projectedConversions,
        projectedRevenue,
        projectedCost,
        projectedProfit,
        projectedROI,
      };
    });
  }, [scenarios, simulatorRecipients, campaignCost]);

  // Update parent when scenarios change
  useMemo(() => {
    if (onScenariosChange) {
      onScenariosChange(calculatedScenarios);
    }
  }, [calculatedScenarios, onScenariosChange]);

  // Generate chart data for sensitivity analysis
  const sensitivityData = useMemo(() => {
    const data = [];
    for (let rate = 1; rate <= 15; rate += 0.5) {
      const conversions = Math.round(simulatorRecipients * (rate / 100));
      const revenue = conversions * currentAverageTicket;
      const cost = simulatorRecipients * campaignCost;
      const profit = revenue - cost;
      const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;

      data.push({
        conversionRate: rate,
        revenue,
        profit,
        roi,
        breakeven: rate === Math.ceil((campaignCost / currentAverageTicket) * 100),
      });
    }
    return data;
  }, [simulatorRecipients, currentAverageTicket, campaignCost]);

  const breakevenRate = useMemo(() => {
    return (campaignCost / currentAverageTicket) * 100;
  }, [campaignCost, currentAverageTicket]);

  const addScenario = () => {
    if (!newScenario.name.trim()) {
      toast.error("Digite um nome para o cenário");
      return;
    }

    const scenario: SimulatorScenario = {
      id: Date.now().toString(),
      name: newScenario.name,
      conversionRate: newScenario.conversionRate,
      averageTicket: newScenario.averageTicket,
      projectedRevenue: 0,
      projectedROI: 0,
      projectedConversions: 0,
      projectedCost: 0,
      projectedProfit: 0,
    };

    setScenarios([...scenarios, scenario]);
    setNewScenario({
      name: "",
      conversionRate: currentConversionRate * 1.2,
      averageTicket: currentAverageTicket * 1.1,
    });
    toast.success("Cenário adicionado!");
  };

  const removeScenario = (id: string) => {
    if (id === "current") return;
    setScenarios(scenarios.filter((s) => s.id !== id));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const bestScenario = calculatedScenarios.reduce((best, current) =>
    current.projectedROI > best.projectedROI ? current : best
  );

  return (
    <div className="space-y-6">
      {/* Simulator Controls */}
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Simulador de ROI
          </CardTitle>
          <CardDescription>
            Projete receita e ROI com diferentes cenários de conversão e ticket médio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Base Recipients */}
          <div className="space-y-2">
            <Label>Base de destinatários para simulação</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[simulatorRecipients]}
                onValueChange={(v) => setSimulatorRecipients(v[0])}
                min={100}
                max={10000}
                step={100}
                className="flex-1"
              />
              <Input
                type="number"
                value={simulatorRecipients}
                onChange={(e) => setSimulatorRecipients(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Custo estimado: {formatCurrency(simulatorRecipients * campaignCost)}
            </p>
          </div>

          {/* Add New Scenario */}
          <div className="p-4 rounded-lg border border-dashed border-border bg-muted/30">
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Cenário
            </h4>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>Nome do cenário</Label>
                <Input
                  placeholder="Ex: Otimista"
                  value={newScenario.name}
                  onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Taxa de conversão (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newScenario.conversionRate}
                  onChange={(e) => setNewScenario({ ...newScenario, conversionRate: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Ticket médio (R$)</Label>
                <Input
                  type="number"
                  step="10"
                  value={newScenario.averageTicket}
                  onChange={(e) => setNewScenario({ ...newScenario, averageTicket: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addScenario} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenarios Table */}
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Comparação de Cenários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cenário</TableHead>
                  <TableHead className="text-center">Taxa Conv.</TableHead>
                  <TableHead className="text-center">Ticket Médio</TableHead>
                  <TableHead className="text-center">Conversões</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculatedScenarios.map((scenario) => (
                  <TableRow
                    key={scenario.id}
                    className={scenario.id === bestScenario.id && calculatedScenarios.length > 1 ? "bg-green-500/5" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{scenario.name}</span>
                        {scenario.id === "current" && (
                          <Badge variant="secondary" className="text-xs">Base</Badge>
                        )}
                        {scenario.id === bestScenario.id && calculatedScenarios.length > 1 && (
                          <Badge className="text-xs bg-green-500">Melhor</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{scenario.conversionRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-center">{formatCurrency(scenario.averageTicket)}</TableCell>
                    <TableCell className="text-center">{scenario.projectedConversions.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(scenario.projectedRevenue)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${scenario.projectedProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(scenario.projectedProfit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={scenario.projectedROI >= 100 ? "default" : scenario.projectedROI >= 0 ? "secondary" : "destructive"}>
                        {scenario.projectedROI.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {scenario.id !== "current" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeScenario(scenario.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sensitivity Analysis Chart */}
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Análise de Sensibilidade
          </CardTitle>
          <CardDescription>
            Impacto da taxa de conversão no lucro (ticket médio fixo em {formatCurrency(currentAverageTicket)})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={sensitivityData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis 
                dataKey="conversionRate" 
                tickFormatter={(v) => `${v}%`}
                className="text-xs"
              />
              <YAxis 
                tickFormatter={(v) => `R$${v/1000}k`}
                className="text-xs"
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "profit") return [formatCurrency(value), "Lucro"];
                  if (name === "revenue") return [formatCurrency(value), "Receita"];
                  return [value, name];
                }}
                labelFormatter={(label) => `Taxa de conversão: ${label}%`}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <ReferenceLine
                x={breakevenRate}
                stroke="hsl(var(--destructive))"
                strokeDasharray="5 5"
                label={{
                  value: "Break-even",
                  position: "top",
                  fill: "hsl(var(--destructive))",
                  fontSize: 10,
                }}
              />
              <ReferenceLine
                x={currentConversionRate}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                label={{
                  value: "Atual",
                  position: "top",
                  fill: "hsl(var(--primary))",
                  fontSize: 10,
                }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.3}
                name="profit"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-muted-foreground">Taxa atual: {currentConversionRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span className="text-muted-foreground">Break-even: {breakevenRate.toFixed(2)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Insights */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Target className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa mínima (break-even)</p>
                <p className="text-xl font-bold">{breakevenRate.toFixed(2)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Melhor cenário (lucro)</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(bestScenario.projectedProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-purple-500/10">
                <TrendingUp className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Potencial de melhoria</p>
                <p className="text-xl font-bold">
                  +{((bestScenario.projectedROI / (calculatedScenarios[0]?.projectedROI || 1)) * 100 - 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
