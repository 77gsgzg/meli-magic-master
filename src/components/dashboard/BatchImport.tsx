import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Layers, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  RotateCcw,
  Play,
  Pause,
  Clock,
  AlertTriangle,
  LinkIcon,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useAuth";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type BatchStep = 'idle' | 'validating' | 'processing' | 'paused' | 'complete';

interface UrlValidation {
  url: string;
  isValid: boolean;
  error?: string;
}

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
  log_id?: string;
  total: number;
  processed: number;
  successCount: number;
  failedCount: number;
  remainingCount?: number;
  wasPaused?: boolean;
  canResume?: boolean;
  items: BatchItem[];
}

// Common product URL patterns
const PRODUCT_URL_PATTERNS = [
  /mercadolivre\.com\.br.*\/p\//i,
  /amazon\.com.*\/dp\//i,
  /amazon\.com\.br.*\/dp\//i,
  /shopee\.com\.br.*\/product\//i,
  /magazineluiza\.com\.br.*\/p\//i,
  /americanas\.com\.br.*\/produto\//i,
  /casasbahia\.com\.br.*\/produto\//i,
  /extra\.com\.br.*\/produto\//i,
  /submarino\.com\.br.*\/produto\//i,
  /aliexpress\.com.*\/item\//i,
  /produto|product|item|dp/i, // Generic patterns
];

export function BatchImport() {
  const [urlsText, setUrlsText] = useState("");
  const [step, setStep] = useState<BatchStep>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [isPauseRequested, setIsPauseRequested] = useState(false);
  
  const { session } = useRequireAuth();
  const { connection } = useMercadoLivre();
  const navigate = useNavigate();

  // URL validation with pattern matching
  const validateUrl = (url: string): UrlValidation => {
    const trimmedUrl = url.trim();
    
    if (!trimmedUrl) {
      return { url: trimmedUrl, isValid: false, error: "URL vazia" };
    }

    try {
      const parsed = new URL(trimmedUrl);
      
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { url: trimmedUrl, isValid: false, error: "Protocolo inválido" };
      }

      // Check if it looks like a product URL
      const isLikelyProduct = PRODUCT_URL_PATTERNS.some(pattern => pattern.test(trimmedUrl));
      
      if (!isLikelyProduct) {
        // Still valid but with warning - might not be a product page
        return { url: trimmedUrl, isValid: true, error: "Pode não ser uma página de produto" };
      }

      return { url: trimmedUrl, isValid: true };
    } catch {
      return { url: trimmedUrl, isValid: false, error: "URL inválida" };
    }
  };

  // Parse and validate all URLs with memoization
  const urlValidations = useMemo(() => {
    return urlsText
      .split(/[\n,;]+/)
      .map(url => url.trim())
      .filter(url => url.length > 0)
      .map(validateUrl);
  }, [urlsText]);

  const validUrls = urlValidations.filter(v => v.isValid);
  const invalidUrls = urlValidations.filter(v => !v.isValid);
  const warningUrls = validUrls.filter(v => v.error);

  const handleBatchImport = async () => {
    const urlsToImport = validUrls.map(v => v.url);
    
    if (urlsToImport.length === 0) {
      toast.error("Adicione pelo menos uma URL válida");
      return;
    }

    if (urlsToImport.length > 20) {
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

    // Show validation step briefly
    setStep('validating');
    setProgress(5);
    setResult(null);
    
    // Validate URLs visually
    await new Promise(resolve => setTimeout(resolve, 500));

    setStep('processing');
    setProgress(10);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 95));
    }, 1000);

    try {
      const response = await supabase.functions.invoke('batch-import', {
        body: { urls: urlsToImport, period_filter: periodFilter },
      });

      clearInterval(progressInterval);

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao processar lote');
      }

      const data = response.data as BatchResult;

      if (data.success) {
        if (data.wasPaused) {
          setStep('paused');
          setProgress(Math.round((data.processed / data.total) * 100));
          setResult(data);
          setCurrentLogId(data.log_id || null);
          toast.info(`Importação pausada. ${data.remainingCount} produto(s) restante(s).`);
        } else {
          setStep('complete');
          setProgress(100);
          setResult(data);
          
          if (data.successCount > 0) {
            toast.success(`${data.successCount} produto(s) publicado(s) com sucesso!`);
          }
          if (data.failedCount > 0) {
            toast.warning(`${data.failedCount} produto(s) falharam`);
          }
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
    } finally {
      setIsPauseRequested(false);
    }
  };

  const handlePause = async () => {
    if (!currentLogId) return;
    
    setIsPauseRequested(true);
    
    try {
      // Mark the log as paused - the edge function will check this
      await supabase
        .from('batch_import_logs')
        .update({ is_paused: true })
        .eq('id', currentLogId);

      toast.info("Solicitando pausa...");
    } catch (err) {
      console.error("Pause error:", err);
      setIsPauseRequested(false);
    }
  };

  const handleResume = async () => {
    if (!result?.log_id) return;

    setStep('processing');
    setIsPauseRequested(false);

    try {
      // Get remaining URLs from the log
      const { data: logData } = await supabase
        .from('batch_import_logs')
        .select('remaining_urls')
        .eq('id', result.log_id)
        .single();

      if (!logData?.remaining_urls?.length) {
        toast.error("Nenhuma URL restante para processar");
        return;
      }

      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 2, 95));
      }, 1000);

      const response = await supabase.functions.invoke('batch-import', {
        body: { 
          urls: logData.remaining_urls, 
          resume_log_id: result.log_id 
        },
      });

      clearInterval(progressInterval);

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data as BatchResult;

      if (data.success) {
        if (data.wasPaused) {
          setStep('paused');
          setResult(data);
          toast.info(`Importação pausada. ${data.remainingCount} produto(s) restante(s).`);
        } else {
          setStep('complete');
          setProgress(100);
          setResult(data);
          toast.success(`Retomada concluída! ${data.successCount} publicado(s).`);
        }
      }
    } catch (err) {
      console.error("Resume error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao retomar");
      setStep('paused');
    }
  };

  const handleReset = () => {
    setUrlsText("");
    setStep('idle');
    setProgress(0);
    setResult(null);
    setCurrentLogId(null);
    setIsPauseRequested(false);
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
              {step === 'paused' && "Importação pausada"}
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
        {/* Idle State - Input with Validation */}
        {step === 'idle' && (
          <>
            <Textarea
              placeholder={`Cole as URLs dos produtos (uma por linha)\n\nhttps://www.mercadolivre.com.br/produto-1\nhttps://www.amazon.com.br/dp/produto-2\nhttps://www.shopee.com.br/product/produto-3`}
              className="min-h-[150px] font-mono text-sm"
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
            />
            
            {/* URL Validation Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  {validUrls.length > 0 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">{validUrls.length}</span> válida(s)
                    </span>
                  )}
                  {invalidUrls.length > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-4 w-4" />
                      <span className="font-medium">{invalidUrls.length}</span> inválida(s)
                    </span>
                  )}
                  {warningUrls.length > 0 && (
                    <span className="flex items-center gap-1 text-warning">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">{warningUrls.length}</span> com aviso
                    </span>
                  )}
                  {validUrls.length > 20 && (
                    <span className="text-destructive font-medium">(máx: 20)</span>
                  )}
                </div>
                {validUrls.length > 0 && validUrls.length <= 20 && (
                  <Badge variant="outline">
                    ~{Math.ceil(validUrls.length * 0.5)} min
                  </Badge>
                )}
              </div>

              {/* Show invalid URLs */}
              {invalidUrls.length > 0 && (
                <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive mb-1">URLs inválidas:</p>
                  <div className="space-y-1">
                    {invalidUrls.slice(0, 3).map((v, i) => (
                      <p key={i} className="text-xs text-destructive/80 truncate flex items-center gap-1">
                        <LinkIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{v.url || "(vazio)"}</span>
                        <span className="text-destructive/60">- {v.error}</span>
                      </p>
                    ))}
                    {invalidUrls.length > 3 && (
                      <p className="text-xs text-destructive/60">+{invalidUrls.length - 3} mais...</p>
                    )}
                  </div>
                </div>
              )}

              {/* Show warning URLs */}
              {warningUrls.length > 0 && invalidUrls.length === 0 && (
                <div className="p-2 rounded-md bg-warning/10 border border-warning/20">
                  <p className="text-xs font-medium text-warning mb-1">URLs com aviso:</p>
                  <div className="space-y-1">
                    {warningUrls.slice(0, 2).map((v, i) => (
                      <p key={i} className="text-xs text-warning/80 truncate">
                        {v.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleBatchImport}
              disabled={validUrls.length === 0 || validUrls.length > 20}
            >
              <Play className="h-5 w-5" />
              Iniciar Importação em Lote
              {validUrls.length > 0 && ` (${validUrls.length})`}
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
                Processando {validUrls.length} produto(s)...
              </p>
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              <Badge variant="info">Extração</Badge>
              <Badge variant="info">Otimização IA</Badge>
              <Badge variant="info">Publicação</Badge>
            </div>
            
            {/* Pause Button */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handlePause}
              disabled={isPauseRequested}
            >
              {isPauseRequested ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pausando...
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Pausar Importação
                </>
              )}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              O progresso será salvo automaticamente
            </p>
          </div>
        )}

        {/* Paused State */}
        {step === 'paused' && result && (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
                <Pause className="h-8 w-8 text-warning" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                {result.processed} de {result.total} processado(s) • {result.remainingCount} restante(s)
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-4">
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {result.successCount} sucesso
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {result.failedCount} falha
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2"
                onClick={handleResume}
              >
                <Play className="h-4 w-4" />
                Retomar
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                Descartar
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              O progresso foi salvo. Você pode retomar a qualquer momento.
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
