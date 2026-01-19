import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PriceChange {
  productId: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  supplierUrl: string;
}

interface SupplierRescrapeManagerProps {
  onPriceChangesDetected?: (changes: PriceChange[]) => void;
}

export function SupplierRescrapeManager({ onPriceChangesDetected }: SupplierRescrapeManagerProps) {
  const { t } = useLanguage();
  const [isRescraping, setIsRescraping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleRescrape = async () => {
    setIsRescraping(true);
    setProgress(10);
    setPriceChanges([]);
    setErrors([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      setProgress(30);

      const { data, error } = await supabase.functions.invoke("rescrape-supplier", {
        body: { checkAll: true },
      });

      setProgress(90);

      if (error) {
        throw error;
      }

      if (data.changes && data.changes.length > 0) {
        setPriceChanges(data.changes);
        onPriceChangesDetected?.(data.changes);
        toast.success(`${data.changes.length} mudança(s) de preço detectada(s)!`);
      } else {
        toast.info("Nenhuma mudança de preço detectada");
      }

      if (data.errors) {
        setErrors(data.errors);
      }

      setLastCheck(new Date());
      setProgress(100);
    } catch (error) {
      console.error("Error rescraping:", error);
      toast.error("Erro ao verificar preços do fornecedor");
    } finally {
      setIsRescraping(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Re-scraping de Preços do Fornecedor
          </CardTitle>
          <CardDescription>
            Verifique automaticamente se os preços dos produtos do fornecedor mudaram
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {lastCheck && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Última verificação: {format(lastCheck, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
            <Button onClick={handleRescrape} disabled={isRescraping}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRescraping ? 'animate-spin' : ''}`} />
              {isRescraping ? "Verificando..." : "Verificar Preços Agora"}
            </Button>
          </div>

          {isRescraping && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                Verificando preços nos sites dos fornecedores...
              </p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="p-3 bg-destructive/10 rounded-lg">
              <p className="text-sm font-medium text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alguns erros ocorreram:
              </p>
              <ul className="text-sm text-destructive/80 mt-2 space-y-1">
                {errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {priceChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Mudanças de Preço Detectadas ({priceChanges.length})
            </CardTitle>
            <CardDescription>
              Os seguintes produtos tiveram alteração de preço no fornecedor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {priceChanges.map((change) => (
                <div
                  key={change.productId}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{change.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground line-through">
                        {formatCurrency(change.oldPrice)}
                      </span>
                      <span className="text-sm font-medium">
                        → {formatCurrency(change.newPrice)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={change.percentageChange > 0 ? "destructive" : "default"}
                      className="flex items-center gap-1"
                    >
                      {change.percentageChange > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {change.percentageChange > 0 ? "+" : ""}
                      {change.percentageChange.toFixed(1)}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(change.supplierUrl, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lastCheck && priceChanges.length === 0 && !isRescraping && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="font-semibold text-lg">Preços Atualizados</h3>
              <p className="text-muted-foreground">
                Todos os preços dos fornecedores estão sincronizados
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
