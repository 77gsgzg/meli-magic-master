import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  DollarSign,
  Calculator
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface PriceRecommendation {
  productId: string;
  title: string;
  currentPrice: number;
  recommendedPrice: number;
  supplierPrice: number;
  currentMargin: number;
  targetMargin: number;
  marginDiff: number;
  reason: string;
  priority: "high" | "medium" | "low";
  action: "increase" | "decrease" | "maintain";
  potentialImpact: number;
}

export function PriceRecommendations() {
  const { user } = useAuth();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const { data: recommendations, isLoading, refetch } = useQuery({
    queryKey: ["price-recommendations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Fetch supplier products with sales data
      const { data: products, error: productsError } = await supabase
        .from("supplier_products")
        .select("id, title, price, margin, target_price, ml_item_id, is_published")
        .eq("user_id", user!.id)
        .eq("is_published", true);

      if (productsError) throw productsError;

      // Fetch recent orders (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: orders, error: ordersError } = await supabase
        .from("ml_orders")
        .select("ml_item_id, total_amount, item_quantity, unit_price")
        .eq("user_id", user!.id)
        .eq("status", "paid")
        .gte("date_created", thirtyDaysAgo.toISOString());

      if (ordersError) throw ordersError;

      const recommendations: PriceRecommendation[] = [];

      for (const product of products || []) {
        if (!product.ml_item_id) continue;

        const productOrders = (orders || []).filter(o => o.ml_item_id === product.ml_item_id);
        const supplierPrice = Number(product.price) || 0;
        const targetMargin = Number(product.margin) || 30;
        const targetPrice = Number(product.target_price) || supplierPrice * (1 + targetMargin / 100);

        if (productOrders.length === 0) {
          // No sales - might need price adjustment
          if (targetPrice > supplierPrice * 1.5) {
            recommendations.push({
              productId: product.id,
              title: product.title,
              currentPrice: targetPrice,
              recommendedPrice: supplierPrice * 1.4,
              supplierPrice,
              currentMargin: ((targetPrice - supplierPrice) / targetPrice) * 100,
              targetMargin,
              marginDiff: 0,
              reason: "Sem vendas nos últimos 30 dias. Considere reduzir o preço para aumentar competitividade.",
              priority: "medium",
              action: "decrease",
              potentialImpact: 0,
            });
          }
          continue;
        }

        const revenue = productOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        const unitsSold = productOrders.reduce((sum, o) => sum + (o.item_quantity || 1), 0);
        const avgSellingPrice = revenue / unitsSold;
        const cost = supplierPrice * unitsSold;
        const profit = revenue - cost;
        const currentMargin = (profit / revenue) * 100;
        const marginDiff = currentMargin - targetMargin;

        // Determine recommendation
        let recommendation: PriceRecommendation | null = null;

        if (marginDiff < -10) {
          // Margin is significantly below target - need to increase price
          const priceIncrease = (targetMargin - currentMargin) / 100 * avgSellingPrice;
          const newPrice = avgSellingPrice + priceIncrease;
          
          recommendations.push({
            productId: product.id,
            title: product.title,
            currentPrice: avgSellingPrice,
            recommendedPrice: Math.round(newPrice * 100) / 100,
            supplierPrice,
            currentMargin: Math.round(currentMargin * 100) / 100,
            targetMargin,
            marginDiff: Math.round(marginDiff * 100) / 100,
            reason: `Margem ${Math.abs(marginDiff).toFixed(1)}% abaixo da meta. Aumente o preço para atingir a rentabilidade desejada.`,
            priority: marginDiff < -20 ? "high" : "medium",
            action: "increase",
            potentialImpact: priceIncrease * unitsSold * 0.8, // Estimate 80% sales retention
          });
        } else if (marginDiff > 15) {
          // Margin is significantly above target - could lower price to increase sales
          const priceDecrease = (currentMargin - targetMargin - 5) / 100 * avgSellingPrice;
          const newPrice = avgSellingPrice - priceDecrease;
          
          recommendations.push({
            productId: product.id,
            title: product.title,
            currentPrice: avgSellingPrice,
            recommendedPrice: Math.round(newPrice * 100) / 100,
            supplierPrice,
            currentMargin: Math.round(currentMargin * 100) / 100,
            targetMargin,
            marginDiff: Math.round(marginDiff * 100) / 100,
            reason: `Margem ${marginDiff.toFixed(1)}% acima da meta. Reduzir o preço pode aumentar o volume de vendas.`,
            priority: "low",
            action: "decrease",
            potentialImpact: unitsSold * 0.3 * profit / unitsSold, // Estimate 30% more sales
          });
        }
      }

      // Sort by priority and potential impact
      return recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.potentialImpact - a.potentialImpact;
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleApplyRecommendation = async (rec: PriceRecommendation) => {
    setApplyingId(rec.productId);
    try {
      const { error } = await supabase
        .from("supplier_products")
        .update({ 
          target_price: rec.recommendedPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rec.productId);

      if (error) throw error;

      toast.success("Preço recomendado aplicado! Sincronize com o Mercado Livre para atualizar o anúncio.");
      refetch();
    } catch (error) {
      console.error("Error applying recommendation:", error);
      toast.error("Erro ao aplicar recomendação");
    } finally {
      setApplyingId(null);
    }
  };

  const summary = useMemo(() => {
    if (!recommendations) return null;
    return {
      total: recommendations.length,
      high: recommendations.filter(r => r.priority === "high").length,
      medium: recommendations.filter(r => r.priority === "medium").length,
      low: recommendations.filter(r => r.priority === "low").length,
      totalPotentialImpact: recommendations.reduce((sum, r) => sum + r.potentialImpact, 0),
    };
  }, [recommendations]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center">
            <Calculator className="h-8 w-8 animate-pulse text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Analisando rentabilidade...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Recomendações de Ajuste de Preço
          </CardTitle>
          <CardDescription>
            Sugestões baseadas na análise de margem real vs esperada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary && summary.total > 0 ? (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Total de Recomendações</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
              <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/20">
                <p className="text-sm text-red-600 dark:text-red-400">Alta Prioridade</p>
                <p className="text-2xl font-bold text-red-600">{summary.high}</p>
              </div>
              <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">Média Prioridade</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.medium}</p>
              </div>
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                <p className="text-sm text-green-600 dark:text-green-400">Impacto Potencial</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPotentialImpact)}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="font-semibold text-lg">Preços Otimizados</h3>
              <p className="text-muted-foreground text-center">
                Todos os seus produtos estão com preços alinhados às metas de margem
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations List */}
      {recommendations && recommendations.length > 0 && (
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <Card key={rec.productId} className={
              rec.priority === "high" 
                ? "border-red-200 dark:border-red-900" 
                : rec.priority === "medium" 
                ? "border-yellow-200 dark:border-yellow-900" 
                : ""
            }>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        rec.action === "increase" 
                          ? "bg-red-100 dark:bg-red-900/30" 
                          : "bg-green-100 dark:bg-green-900/30"
                      }`}>
                        {rec.action === "increase" ? (
                          <TrendingUp className="h-5 w-5 text-red-600" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{rec.title}</h4>
                          <Badge variant={
                            rec.priority === "high" 
                              ? "destructive" 
                              : rec.priority === "medium" 
                              ? "secondary" 
                              : "outline"
                          }>
                            {rec.priority === "high" 
                              ? "Alta Prioridade" 
                              : rec.priority === "medium" 
                              ? "Média Prioridade" 
                              : "Baixa Prioridade"
                            }
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{rec.reason}</p>
                        
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Preço Atual</p>
                            <p className="font-semibold">{formatCurrency(rec.currentPrice)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Margem: {rec.currentMargin.toFixed(1)}%
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-center">
                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                          
                          <div className={`p-3 rounded-lg ${
                            rec.action === "increase" 
                              ? "bg-green-100 dark:bg-green-900/30" 
                              : "bg-blue-100 dark:bg-blue-900/30"
                          }`}>
                            <p className="text-xs text-muted-foreground">Preço Recomendado</p>
                            <p className="font-semibold">{formatCurrency(rec.recommendedPrice)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Margem: {rec.targetMargin.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Custo fornecedor:</span>
                          <span className="font-medium">{formatCurrency(rec.supplierPrice)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 md:w-48">
                    <Button 
                      onClick={() => handleApplyRecommendation(rec)}
                      disabled={applyingId === rec.productId}
                      className="w-full"
                    >
                      {applyingId === rec.productId ? (
                        "Aplicando..."
                      ) : (
                        "Aplicar Recomendação"
                      )}
                    </Button>
                    {rec.potentialImpact > 0 && (
                      <p className="text-xs text-center text-muted-foreground">
                        Impacto potencial: {formatCurrency(rec.potentialImpact)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
