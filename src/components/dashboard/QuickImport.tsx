import { useState } from "react";
import { AnimatedCard, AnimatedCardContent, AnimatedCardHeader, AnimatedCardTitle, AnimatedCardDescription } from "@/components/ui/animated-card";
import { Input } from "@/components/ui/input";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Link2, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  RotateCcw,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useAuth";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type PublishStep = 'idle' | 'processing' | 'success' | 'error';

interface PublishResult {
  success: boolean;
  step?: string;
  product_id?: string;
  ml_item_id?: string;
  ml_permalink?: string;
  title?: string;
  price?: number;
  images_count?: number;
  error?: string;
  error_details?: unknown;
}

export function QuickImport() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<PublishStep>('idle');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<PublishResult | null>(null);
  
  const { session } = useRequireAuth();
  const { connection } = useMercadoLivre();
  const navigate = useNavigate();

  const handleAutoPublish = async () => {
    if (!url) {
      toast.error("Cole um link de produto válido");
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
    setProgress(10);
    setStatusText("Acessando link do produto...");
    setResult(null);

    try {
      const progressSteps = [
        { progress: 25, text: "Extraindo dados do produto..." },
        { progress: 50, text: "Otimizando com IA..." },
        { progress: 75, text: "Validando para Mercado Livre..." },
        { progress: 90, text: "Publicando na sua loja..." },
      ];

      let stepIndex = 0;
      const progressInterval = setInterval(() => {
        if (stepIndex < progressSteps.length) {
          setProgress(progressSteps[stepIndex].progress);
          setStatusText(progressSteps[stepIndex].text);
          stepIndex++;
        }
      }, 2000);

      const response = await supabase.functions.invoke('auto-publish', {
        body: { url },
      });

      clearInterval(progressInterval);

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao processar');
      }

      const data = response.data as PublishResult;

      if (data.success) {
        setStep('success');
        setProgress(100);
        setStatusText("Produto publicado com sucesso!");
        setResult(data);
        toast.success(`Produto publicado: ${data.title?.substring(0, 40)}...`);
      } else {
        setStep('error');
        setProgress(0);
        setStatusText(data.error || "Erro na publicação");
        setResult(data);
        toast.error(data.error || "Erro ao publicar produto");
      }
    } catch (err) {
      console.error("Auto-publish error:", err);
      setStep('error');
      setProgress(0);
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      setStatusText(errorMsg);
      setResult({ success: false, error: errorMsg });
      toast.error(errorMsg);
    }
  };

  const handleReset = () => {
    setUrl("");
    setStep('idle');
    setProgress(0);
    setStatusText("");
    setResult(null);
  };

  // Not connected state
  if (!connection.connected && step === 'idle') {
    return (
      <AnimatedCard variant="glass" enableHover enableGlow className="overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-warning/5 via-transparent to-transparent" />
        <AnimatedCardHeader className="relative">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <Zap className="h-5 w-5 text-warning" />
            </div>
            <div>
              <AnimatedCardTitle className="text-lg">Publicação Automática</AnimatedCardTitle>
              <AnimatedCardDescription>Conecte o Mercado Livre para publicar</AnimatedCardDescription>
            </div>
          </div>
        </AnimatedCardHeader>
        <AnimatedCardContent className="relative">
          <AnimatedButton 
            className="w-full" 
            variant="outline"
            onClick={() => navigate("/mercado-livre")}
          >
            Conectar Mercado Livre
          </AnimatedButton>
        </AnimatedCardContent>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard variant="glass" enableHover enableGlow className="overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <AnimatedCardHeader className="relative">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <AnimatedCardTitle className="text-lg">Publicação Automática</AnimatedCardTitle>
            <AnimatedCardDescription>
              {step === 'idle' && "Cole o link → Publicação direta"}
              {step === 'processing' && "Processando..."}
              {step === 'success' && "Publicado com sucesso!"}
              {step === 'error' && "Erro na publicação"}
            </AnimatedCardDescription>
          </div>
          {connection.connected && step === 'idle' && (
            <Badge variant="success" className="ml-auto">
              ML Conectado
            </Badge>
          )}
        </div>
      </AnimatedCardHeader>
      
      <AnimatedCardContent className="relative space-y-4">
        {/* Idle State - Input */}
        {step === 'idle' && (
          <>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                variant="glass"
                placeholder="https://www.exemplo.com.br/produto..."
                className="pl-10 pr-4 h-12"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAutoPublish()}
              />
            </div>
            <AnimatedButton
              className="w-full"
              size="lg"
              onClick={handleAutoPublish}
              disabled={!url}
            >
              <Sparkles className="h-5 w-5" />
              Publicar Automaticamente
            </AnimatedButton>
            <p className="text-xs text-center text-muted-foreground">
              Extração + Otimização IA + Publicação direta no Mercado Livre
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
                {statusText}
              </p>
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              {progress >= 10 && <Badge variant="outline">Acessando URL</Badge>}
              {progress >= 25 && <Badge variant="outline">Extraindo Dados</Badge>}
              {progress >= 50 && <Badge variant="info">Otimização IA</Badge>}
              {progress >= 75 && <Badge variant="warning">Validando</Badge>}
              {progress >= 90 && <Badge variant="success">Publicando</Badge>}
            </div>
          </div>
        )}

        {/* Success State */}
        {step === 'success' && result && (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-semibold text-green-500">Produto Publicado!</h4>
              <p className="text-sm text-muted-foreground truncate max-w-full">
                {result.title}
              </p>
              {result.price && (
                <p className="text-lg font-bold">
                  R$ {result.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {result.ml_permalink && (
                <AnimatedButton 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => window.open(result.ml_permalink, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver no Mercado Livre
                </AnimatedButton>
              )}
              <AnimatedButton 
                className="w-full gap-2"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                Publicar Outro Produto
              </AnimatedButton>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              ID: {result.ml_item_id} • {result.images_count} imagens
            </p>
          </div>
        )}

        {/* Error State */}
        {step === 'error' && result && (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-semibold text-destructive">Erro na Publicação</h4>
              <p className="text-sm text-muted-foreground">
                {result.error}
              </p>
              {result.step && (
                <Badge variant="outline" className="mt-2">
                  Falhou em: {result.step}
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <AnimatedButton 
                className="w-full gap-2"
                onClick={() => {
                  setStep('idle');
                  setProgress(0);
                  setResult(null);
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Tentar Novamente
              </AnimatedButton>
              <AnimatedButton 
                variant="outline"
                className="w-full"
                onClick={handleReset}
              >
                Novo Link
              </AnimatedButton>
            </div>
          </div>
        )}
      </AnimatedCardContent>
    </AnimatedCard>
  );
}
