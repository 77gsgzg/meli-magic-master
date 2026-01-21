import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings2,
  Zap,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface PriceChange {
  id: string;
  title: string;
  currentPrice: number;
  expectedPrice: number;
  difference: number;
}

interface SyncResult {
  synced: number;
  ml_updated?: number;
  errors?: number;
  results?: Array<{
    id: string;
    status: string;
    newPrice?: number;
    ml_item_id?: string;
    error?: string;
  }>;
}

interface PriceSyncManagerProps {
  userId: string;
}

export function PriceSyncManager({ userId }: PriceSyncManagerProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [autoSync, setAutoSync] = useState(true);

  useEffect(() => {
    // Check for price changes on mount
    handleCheckPrices();
  }, [userId]);

  const handleCheckPrices = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-supplier-prices", {
        body: { action: "check_price_changes" },
      });

      if (error) throw error;

      if (data.priceChanges) {
        setPriceChanges(data.priceChanges);
        if (data.priceChanges.length > 0) {
          toast.info(`${data.priceChanges.length} produto(s) com preço desatualizado`);
        }
      }
    } catch (error: any) {
      console.error("Error checking prices:", error);
      toast.error("Erro ao verificar preços");
    } finally {
      setChecking(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-supplier-prices", {
        body: { action: "sync_all" },
      });

      if (error) throw error;

      setLastSyncResult({
        synced: data.synced || 0,
        ml_updated: data.ml_updated,
        errors: data.errors || 0,
        results: data.results,
      });

      if (data.synced > 0) {
        toast.success(`${data.synced} preço(s) sincronizado(s)${data.ml_updated ? `, ${data.ml_updated} atualizado(s) no ML` : ''}`);
      }
      if (data.errors > 0) {
        toast.warning(`${data.errors} erro(s) durante sincronização`);
      }

      // Clear price changes after sync
      setPriceChanges([]);
    } catch (error: any) {
      console.error("Error syncing prices:", error);
      toast.error("Erro ao sincronizar preços");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncSelected = async (productIds: string[]) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-supplier-prices", {
        body: { action: "sync_selected", productIds },
      });

      if (error) throw error;

      toast.success(`${data.synced || 0} preço(s) sincronizado(s)`);
      
      // Remove synced items from list
      setPriceChanges(prev => prev.filter(p => !productIds.includes(p.id)));
    } catch (error: any) {
      console.error("Error syncing selected prices:", error);
      toast.error("Erro ao sincronizar preços selecionados");
    } finally {
      setSyncing(false);
    }
  };

  const totalDifference = priceChanges.reduce((sum, p) => sum + p.difference, 0);

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Sincronização de Preços ML
            </CardTitle>
            <CardDescription>
              Sincronize automaticamente os preços no Mercado Livre quando o fornecedor altera
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="auto-sync"
                checked={autoSync}
                onCheckedChange={setAutoSync}
              />
              <Label htmlFor="auto-sync" className="text-sm">
                Auto-sync ativo
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info about auto-sync */}
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Sincronização Automática</p>
              <p className="text-sm text-muted-foreground">
                Quando o re-scraping detecta alterações de preço do fornecedor, os preços no Mercado Livre 
                são atualizados automaticamente aplicando a margem configurada.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={handleCheckPrices}
            disabled={checking}
            className="gap-2"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Verificar Desatualizados
          </Button>
          <Button 
            onClick={handleSyncAll}
            disabled={syncing}
            className="gap-2"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings2 className="h-4 w-4" />
            )}
            Sincronizar Todos
          </Button>
        </div>

        {/* Last Sync Result */}
        {lastSyncResult && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-500 mb-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Última Sincronização</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Sincronizados:</span>
                <span className="ml-2 font-medium">{lastSyncResult.synced}</span>
              </div>
              {lastSyncResult.ml_updated !== undefined && (
                <div>
                  <span className="text-muted-foreground">Atualizados ML:</span>
                  <span className="ml-2 font-medium">{lastSyncResult.ml_updated}</span>
                </div>
              )}
              {lastSyncResult.errors !== undefined && lastSyncResult.errors > 0 && (
                <div>
                  <span className="text-muted-foreground">Erros:</span>
                  <span className="ml-2 font-medium text-destructive">{lastSyncResult.errors}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Price Changes List */}
        {priceChanges.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                Produtos com preço desatualizado
              </h4>
              <Badge variant={totalDifference > 0 ? "default" : "destructive"} className="gap-1">
                {totalDifference > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {totalDifference > 0 ? "+" : ""}R$ {totalDifference.toFixed(2)}
              </Badge>
            </div>

            <ScrollArea className="h-[200px] border rounded-lg">
              <div className="p-2 space-y-2">
                {priceChanges.map((change) => (
                  <div 
                    key={change.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{change.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Atual: R$ {change.currentPrice.toFixed(2)}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-primary font-medium">
                          R$ {change.expectedPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={change.difference > 0 ? "default" : "destructive"}
                        className="gap-1"
                      >
                        {change.difference > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {change.difference > 0 ? "+" : ""}
                        R$ {change.difference.toFixed(2)}
                      </Badge>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleSyncSelected([change.id])}
                        disabled={syncing}
                      >
                        Sincronizar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Button 
              className="w-full gap-2"
              onClick={() => handleSyncSelected(priceChanges.map(p => p.id))}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar Todos ({priceChanges.length})
            </Button>
          </div>
        )}

        {priceChanges.length === 0 && !checking && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-muted-foreground">Todos os preços estão sincronizados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
