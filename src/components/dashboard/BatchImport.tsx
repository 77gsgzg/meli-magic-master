import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Layers, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  RotateCcw,
  Play,
  Clock,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useAuth";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type BatchStep = 'idle' | 'processing' | 'complete';

interface BatchItem {
  url: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  product_id?: string;
  ml_item_id?: string;
  ml_permalink?: string;
  title?: string;
  price?: number;
  error?: string;
}

interface BatchResult {
  success: boolean;
  batch_id: string;
  total: number;
  processed: number;
  successCount: number;
  failedCount: number;
  items: BatchItem[];
}

export function BatchImport() {
  const [urlsText, setUrlsText] = useState("");
  const [step, setStep] = useState<BatchStep>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BatchResult | null>(null);
  
  const { session } = useRequireAuth();
  const { connection } = useMercadoLivre();
  const navigate = useNavigate();

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

  const urls = parseUrls(urlsText);

  const handleBatchImport = async () => {
    if (urls.length === 0) {
      toast.error("Adicione pelo menos uma URL válida");
      return;
    }

    if (urls.length > 20) {
      toast.error("Máximo de 20 URLs por lote");
      return;
    }

    if (!session?.access_token) {
      toast.error("Você precisa estar logado");
      return;
    }

    if (!connection.connected) {
      toast.error("Conecte sua conta do Mercado Livre primeiro");
      navigate("/mercado-livre");
      return;
    }

    setStep('processing');
    setProgress(0);
    setResult(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 95));
    }, 1000);

    try {
      const response = await supabase.functions.invoke('batch-import', {
        body: { urls },
      });

      clearInterval(progressInterval);

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao processar lote');
      }

      const data = response.data as BatchResult;

      if (data.success) {
        setStep('complete');
        setProgress(100);
        setResult(data);
        
        if (data.successCount > 0) {
          toast.success(`${data.successCount} produto(s) publicado(s) com sucesso!`);
        }
        if (data.failedCount > 0) {
          toast.warning(`${data.failedCount} produto(s) falharam`);
        }
      } else {
        throw new Error('Erro ao processar lote');
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error("Batch import error:", err);
      setStep('idle');
      setProgress(0);
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleReset = () => {
    setUrlsText("");
    setStep('idle');
    setProgress(0);
    setResult(null);
  };

  const getStatusIcon = (status: BatchItem['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: BatchItem['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Aguardando</Badge>;
      case 'processing':
        return <Badge variant="info">Processando</Badge>;
      case 'success':
        return <Badge variant="success">Publicado</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
    }
  };

  // Not connected state
  if (!connection.connected && step === 'idle') {
    return (
      <Card variant="glass" className="animate-fade-in overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-warning/5 via-transparent to-transparent" />
        <CardHeader className="relative">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <Layers className="h-5 w-5 text-warning" />
            </div>
            <div>
              <CardTitle className="text-lg">Importação em Lote</CardTitle>
              <CardDescription>Conecte o Mercado Livre para importar</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => navigate("/mercado-livre")}
          >
            Conectar Mercado Livre
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glass" className="animate-fade-in overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-transparent" />
      <CardHeader className="relative">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
            <Layers className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Importação em Lote</CardTitle>
            <CardDescription>
              {step === 'idle' && `Publique até 20 produtos de uma vez`}
              {step === 'processing' && "Processando URLs..."}
              {step === 'complete' && "Importação concluída!"}
            </CardDescription>
          </div>
          {connection.connected && step === 'idle' && (
            <Badge variant="success" className="ml-auto">
              ML Conectado
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-4">
        {/* Idle State - Input */}
        {step === 'idle' && (
          <>
            <Textarea
              placeholder={`Cole as URLs dos produtos (uma por linha)\n\nhttps://www.exemplo.com/produto-1\nhttps://www.exemplo.com/produto-2\nhttps://www.exemplo.com/produto-3`}
              className="min-h-[150px] font-mono text-sm"
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
            />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {urls.length > 0 ? (
                  <>
                    <span className="font-medium text-foreground">{urls.length}</span> URL(s) válida(s)
                    {urls.length > 20 && (
                      <span className="text-destructive ml-2">(máx: 20)</span>
                    )}
                  </>
                ) : (
                  "Cole URLs para iniciar"
                )}
              </span>
              {urls.length > 0 && urls.length <= 20 && (
                <Badge variant="outline">
                  ~{Math.ceil(urls.length * 0.5)} min
                </Badge>
              )}
            </div>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleBatchImport}
              disabled={urls.length === 0 || urls.length > 20}
            >
              <Play className="h-5 w-5" />
              Iniciar Importação em Lote
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Cada produto será extraído, otimizado e publicado automaticamente
            </p>
          </>
        )}

        {/* Processing State */}
        {step === 'processing' && (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                Processando {urls.length} produto(s)...
              </p>
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              <Badge variant="info">Extração</Badge>
              <Badge variant="info">Otimização IA</Badge>
              <Badge variant="info">Publicação</Badge>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Este processo pode levar alguns minutos
            </p>
          </div>
        )}

        {/* Complete State */}
        {step === 'complete' && result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-center gap-6 py-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{result.successCount}</div>
                <div className="text-xs text-muted-foreground">Publicados</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">{result.failedCount}</div>
                <div className="text-xs text-muted-foreground">Falharam</div>
              </div>
            </div>

            {/* Results List */}
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {result.items.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(item.status)}
                        {item.ml_permalink && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5"
                            onClick={() => window.open(item.ml_permalink, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {item.title ? (
                        <p className="text-sm truncate">{item.title}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                      )}
                      {item.price && (
                        <p className="text-sm font-medium">
                          R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      {item.error && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {item.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button 
                className="w-full gap-2"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                Nova Importação
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Lote ID: {result.batch_id.substring(0, 8)}...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
