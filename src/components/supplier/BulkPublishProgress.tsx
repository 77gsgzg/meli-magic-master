import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Package,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

interface SupplierProduct {
  id: string;
  title: string;
  description?: string | null;
  price?: number | null;
  currency: string;
  image_url?: string | null;
  product_url: string;
  supplier_name: string;
  optimized_title?: string | null;
  optimized_description?: string | null;
  margin?: number | null;
  target_price?: number | null;
}

interface PublishResult {
  productId: string;
  title: string;
  status: "success" | "error" | "pending";
  message?: string;
  mlItemId?: string;
}

interface BulkPublishProgressProps {
  products: SupplierProduct[];
  userId: string;
  onComplete: () => void;
  callMLApi: (action: string, data?: Record<string, unknown>) => Promise<any>;
}

export function BulkPublishProgress({ 
  products, 
  userId, 
  onComplete,
  callMLApi,
}: BulkPublishProgressProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<PublishResult[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);

  const progress = products.length > 0 ? (currentIndex / products.length) * 100 : 0;
  const successCount = results.filter(r => r.status === "success").length;
  const errorCount = results.filter(r => r.status === "error").length;

  const handleStartPublish = () => {
    if (products.length === 0) {
      toast.error("Nenhum produto selecionado para publicar");
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmPublish = async () => {
    setShowConfirmDialog(false);
    setIsPublishing(true);
    setIsPaused(false);
    setShouldStop(false);
    setResults([]);
    setCurrentIndex(0);

    for (let i = 0; i < products.length; i++) {
      if (shouldStop) break;
      
      while (isPaused && !shouldStop) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (shouldStop) break;

      const product = products[i];
      setCurrentIndex(i + 1);

      try {
        const title = product.optimized_title || product.title;
        const description = product.optimized_description || product.description || "";
        const price = product.target_price || 
          (product.price ? product.price * (1 + (product.margin || 30) / 100) : 100);

        // Create product in database first
        const { data: productData, error: productError } = await supabase
          .from("products")
          .insert({
            user_id: userId,
            title: title,
            description: description,
            price: price,
            currency: product.currency,
            images: product.image_url ? [{ url: product.image_url }] : [],
            source_url: product.product_url,
            status: "pending",
          })
          .select()
          .single();

        if (productError) throw productError;

        // Publish to Mercado Livre
        const mlResult = await callMLApi("publish", {
          productId: productData.id,
          title: title,
          description: description,
          price: price,
          images: product.image_url ? [product.image_url] : [],
        });

        // Update supplier product
        await supabase
          .from("supplier_products")
          .update({
            is_published: true,
            published_product_id: productData.id,
            ml_item_id: mlResult?.ml_item_id || null,
          })
          .eq("id", product.id);

        setResults(prev => [...prev, {
          productId: product.id,
          title: product.title,
          status: "success",
          mlItemId: mlResult?.ml_item_id,
        }]);
      } catch (error: any) {
        console.error(`Error publishing product ${product.id}:`, error);
        setResults(prev => [...prev, {
          productId: product.id,
          title: product.title,
          status: "error",
          message: error.message || "Erro desconhecido",
        }]);
      }

      // Small delay between publications
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsPublishing(false);
    if (!shouldStop) {
      toast.success(`Publicação concluída! ${successCount} sucesso, ${errorCount} erros`);
      onComplete();
    }
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleStop = () => {
    setShouldStop(true);
    setIsPaused(false);
    setIsPublishing(false);
    toast.info("Publicação cancelada");
  };

  const handleReset = () => {
    setResults([]);
    setCurrentIndex(0);
    setIsPublishing(false);
    setIsPaused(false);
    setShouldStop(false);
  };

  return (
    <>
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Publicação em Massa
          </CardTitle>
          <CardDescription>
            Publique múltiplos produtos no Mercado Livre de uma vez
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Package className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{products.length}</p>
              <p className="text-xs text-muted-foreground">Selecionados</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-500/10">
              <Loader2 className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold text-blue-500">{currentIndex}</p>
              <p className="text-xs text-muted-foreground">Processados</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold text-green-500">{successCount}</p>
              <p className="text-xs text-muted-foreground">Sucesso</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10">
              <XCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
              <p className="text-2xl font-bold text-red-500">{errorCount}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
          </div>

          {/* Progress Bar */}
          {isPublishing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Publicando produto {currentIndex} de {products.length}
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              {isPaused && (
                <p className="text-sm text-yellow-500 flex items-center gap-1">
                  <Pause className="h-4 w-4" />
                  Pausado
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {!isPublishing ? (
              <>
                <Button 
                  onClick={handleStartPublish}
                  disabled={products.length === 0}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Iniciar Publicação ({products.length})
                </Button>
                {results.length > 0 && (
                  <Button variant="outline" onClick={handleReset} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Limpar Resultados
                  </Button>
                )}
              </>
            ) : (
              <>
                {isPaused ? (
                  <Button onClick={handleResume} className="gap-2">
                    <Play className="h-4 w-4" />
                    Continuar
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handlePause} className="gap-2">
                    <Pause className="h-4 w-4" />
                    Pausar
                  </Button>
                )}
                <Button variant="destructive" onClick={handleStop} className="gap-2">
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </Button>
              </>
            )}
          </div>

          {/* Results List */}
          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Resultados</h4>
              <ScrollArea className="h-[200px] border rounded-lg p-2">
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div 
                      key={index}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        result.status === "success" 
                          ? "bg-green-500/10" 
                          : "bg-red-500/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {result.status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-sm truncate">{result.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.mlItemId && (
                          <Badge variant="outline" className="text-xs">
                            {result.mlItemId}
                          </Badge>
                        )}
                        {result.message && (
                          <span className="text-xs text-red-500 max-w-[150px] truncate">
                            {result.message}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Confirmar Publicação em Massa
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a publicar <strong>{products.length} produtos</strong> no Mercado Livre.
              </p>
              <p>
                Este processo pode levar alguns minutos. Você pode pausar ou cancelar a qualquer momento.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPublish} className="gap-2">
              <Upload className="h-4 w-4" />
              Iniciar Publicação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
