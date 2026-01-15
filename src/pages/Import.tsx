import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequireAuth } from "@/hooks/useAuth";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Link2,
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Image,
  FileText,
  Tag,
  DollarSign,
  RefreshCw,
  Send,
  AlertCircle,
  ExternalLink,
  Zap,
  Edit3,
  XCircle,
  RotateCcw,
} from "lucide-react";

type ImportStep = "input" | "extracting" | "optimizing" | "review" | "publishing" | "done" | "error";
type AutoPublishStep = "idle" | "processing" | "success" | "error";

interface ProductData {
  title: string;
  description: string;
  price: number | null;
  currency: string;
  category: string;
  images: string[];
  attributes: { name: string; value: string }[];
  source_url: string;
}

interface AutoPublishResult {
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

export default function Import() {
  const { session } = useRequireAuth();
  const { connection, loading: mlLoading } = useMercadoLivre();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [url, setUrl] = useState("");
  const [importMode, setImportMode] = useState<"auto" | "manual">("auto");
  
  // Manual mode state
  const [step, setStep] = useState<ImportStep>("input");
  const [error, setError] = useState<string | null>(null);
  const [publishedItemId, setPublishedItemId] = useState<string | null>(null);
  const [productData, setProductData] = useState<ProductData>({
    title: "",
    description: "",
    price: null,
    currency: "BRL",
    category: "",
    images: [],
    attributes: [],
    source_url: "",
  });

  // Auto mode state
  const [autoStep, setAutoStep] = useState<AutoPublishStep>("idle");
  const [autoProgress, setAutoProgress] = useState(0);
  const [autoStatusText, setAutoStatusText] = useState("");
  const [autoResult, setAutoResult] = useState<AutoPublishResult | null>(null);

  // Check for URL in query params
  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setUrl(urlParam);
    }
  }, [searchParams]);

  // Auto-publish function
  const handleAutoPublish = async () => {
    if (!url || !session?.access_token) return;
    if (!connection.connected) {
      toast.error("Conecte sua conta do Mercado Livre primeiro");
      navigate("/mercado-livre");
      return;
    }

    setAutoStep("processing");
    setAutoProgress(10);
    setAutoStatusText("Acessando link do produto...");
    setAutoResult(null);

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
          setAutoProgress(progressSteps[stepIndex].progress);
          setAutoStatusText(progressSteps[stepIndex].text);
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

      const data = response.data as AutoPublishResult;

      if (data.success) {
        setAutoStep("success");
        setAutoProgress(100);
        setAutoResult(data);
        toast.success(`Produto publicado: ${data.title?.substring(0, 40)}...`);
      } else {
        setAutoStep("error");
        setAutoResult(data);
        toast.error(data.error || "Erro ao publicar");
      }
    } catch (err) {
      setAutoStep("error");
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      setAutoResult({ success: false, error: errorMsg });
      toast.error(errorMsg);
    }
  };

  const resetAutoPublish = () => {
    setUrl("");
    setAutoStep("idle");
    setAutoProgress(0);
    setAutoStatusText("");
    setAutoResult(null);
  };

  const extractProduct = async () => {
    if (!session?.access_token) {
      toast.error("Você precisa estar logado");
      return;
    }

    setStep("extracting");
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-product`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao extrair produto");
      }

      setProductData({
        title: result.title || "",
        description: result.description || "",
        price: result.price,
        currency: result.currency || "BRL",
        category: result.category || "",
        images: result.images || [],
        attributes: result.attributes || [],
        source_url: url,
      });

      // Optimize with AI
      setStep("optimizing");
      await optimizeWithAI(result);
    } catch (err) {
      console.error("Extraction error:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("error");
    }
  };

  const optimizeWithAI = async (extractedData: Partial<ProductData>) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-optimize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: extractedData.title,
            description: extractedData.description,
            category: extractedData.category,
            attributes: extractedData.attributes,
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.optimized_title) {
        setProductData((prev) => ({
          ...prev,
          title: result.optimized_title,
          description: result.optimized_description || prev.description,
        }));
      }

      setStep("review");
    } catch (err) {
      console.error("AI optimization error:", err);
      // Continue to review even if AI fails
      setStep("review");
    }
  };

  const handlePublish = async () => {
    if (!connection.connected) {
      toast.error("Conecte sua conta do Mercado Livre primeiro");
      navigate("/mercado-livre");
      return;
    }

    setStep("publishing");

    try {
      // First save to database
      const { data: savedProduct, error: saveError } = await supabase
        .from("products")
        .insert({
          user_id: session?.user?.id,
          title: productData.title,
          description: productData.description,
          price: productData.price,
          currency: productData.currency,
          category_name: productData.category,
          images: productData.images,
          attributes: productData.attributes,
          source_url: productData.source_url,
          original_title: productData.title,
          original_description: productData.description,
          original_price: productData.price,
          ai_optimized: true,
          status: "pending",
        })
        .select()
        .single();

      if (saveError) {
        throw new Error("Erro ao salvar produto");
      }

      // Publish to Mercado Livre
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-api`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "publish_item",
            data: {
              title: productData.title,
              description: productData.description,
              price: productData.price,
              currency_id: productData.currency,
              category_id: productData.category || "MLB1000", // Default category
              pictures: productData.images.map((url) => ({ source: url })),
              condition: "new",
              listing_type_id: "gold_special",
              available_quantity: 1,
            },
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        // Update product status to error
        await supabase
          .from("products")
          .update({
            status: "error",
            error_message: result.error,
          })
          .eq("id", savedProduct.id);

        throw new Error(result.error || "Erro ao publicar no Mercado Livre");
      }

      // Update product with ML info
      await supabase
        .from("products")
        .update({
          status: "published",
          ml_item_id: result.id,
          ml_permalink: result.permalink,
          published_at: new Date().toISOString(),
        })
        .eq("id", savedProduct.id);

      setPublishedItemId(result.id);
      setStep("done");
      toast.success("Produto publicado com sucesso!");
    } catch (err) {
      console.error("Publish error:", err);
      setError(err instanceof Error ? err.message : "Erro ao publicar");
      setStep("error");
    }
  };

  const resetImport = () => {
    setUrl("");
    setStep("input");
    setError(null);
    setPublishedItemId(null);
    setProductData({
      title: "",
      description: "",
      price: null,
      currency: "BRL",
      category: "",
      images: [],
      attributes: [],
      source_url: "",
    });
  };

  // Check ML connection
  if (!mlLoading && !connection.connected && step === "input") {
    return (
      <DashboardLayout
        title="Importar Produto"
        subtitle="Importe e otimize produtos automaticamente com IA"
      >
        <div className="max-w-2xl mx-auto">
          <Card variant="glass">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-warning mb-4" />
              <h3 className="text-xl font-semibold mb-2">Mercado Livre não conectado</h3>
              <p className="text-muted-foreground text-center mb-6">
                Você precisa conectar sua conta do Mercado Livre antes de importar produtos.
              </p>
              <Button onClick={() => navigate("/mercado-livre")}>
                Conectar Mercado Livre
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Importar Produto"
      subtitle="Importe e otimize produtos automaticamente com IA"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {[
            { id: "input", label: "URL" },
            { id: "extracting", label: "Extração" },
            { id: "optimizing", label: "Otimização" },
            { id: "review", label: "Revisão" },
            { id: "publishing", label: "Publicação" },
          ].map((s, i, arr) => {
            const stepOrder = ["input", "extracting", "optimizing", "review", "publishing", "done"];
            const currentIndex = stepOrder.indexOf(step);
            const itemIndex = stepOrder.indexOf(s.id);
            const isComplete = currentIndex > itemIndex;
            const isCurrent = step === s.id;

            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : isComplete
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-muted bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {isComplete ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                </div>
                {i < arr.length - 1 && (
                  <div
                    className={`h-0.5 w-16 mx-2 transition-all ${
                      isComplete ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Input Step */}
        {step === "input" && (
          <Card variant="glass" className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Cole o Link do Produto
              </CardTitle>
              <CardDescription>
                Insira a URL do produto que deseja importar para o Mercado Livre
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                variant="glass"
                placeholder="https://www.exemplo.com.br/produto..."
                className="h-14 text-lg"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button
                className="w-full"
                size="xl"
                onClick={extractProduct}
                disabled={!url}
              >
                <Sparkles className="h-5 w-5" />
                Iniciar Importação com IA
                <ArrowRight className="h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Extracting Step */}
        {step === "extracting" && (
          <Card variant="glass" className="animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              </div>
              <h3 className="mt-6 text-xl font-semibold">Extraindo dados do produto...</h3>
              <p className="mt-2 text-muted-foreground">
                Analisando título, descrição, imagens e atributos
              </p>
            </CardContent>
          </Card>
        )}

        {/* Optimizing Step */}
        {step === "optimizing" && (
          <Card variant="glass" className="animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                </div>
              </div>
              <h3 className="mt-6 text-xl font-semibold">IA otimizando conteúdo...</h3>
              <p className="mt-2 text-muted-foreground">
                Melhorando título, descrição e atributos para o Mercado Livre
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                <Badge variant="info">Otimizando SEO</Badge>
                <Badge variant="warning">Validando categoria</Badge>
                <Badge variant="success">Formatando descrição</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Step */}
        {step === "error" && (
          <Card variant="glass" className="border-destructive/50 animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-destructive">
                Erro na Importação
              </h3>
              <p className="mt-2 text-muted-foreground text-center max-w-md">
                {error || "Ocorreu um erro ao processar o produto"}
              </p>
              <Button className="mt-6" onClick={resetImport}>
                <RefreshCw className="h-4 w-4" />
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Review Step */}
        {(step === "review" || step === "publishing" || step === "done") && (
          <div className="space-y-6 animate-fade-in">
            {/* Images */}
            {productData.images.length > 0 && (
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Image className="h-5 w-5 text-primary" />
                    Imagens do Produto ({productData.images.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {productData.images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt={`Imagem ${i + 1}`}
                        className="h-32 w-32 rounded-lg object-cover border border-border flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Title */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-primary" />
                  Título Otimizado
                  <Badge variant="success" className="ml-auto">
                    IA
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  variant="glass"
                  value={productData.title}
                  onChange={(e) =>
                    setProductData({ ...productData, title: e.target.value })
                  }
                  disabled={step !== "review"}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {productData.title.length}/60 caracteres recomendados
                </p>
              </CardContent>
            </Card>

            {/* Description */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-primary" />
                  Descrição Otimizada
                  <Badge variant="success" className="ml-auto">
                    IA
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[200px] glass border-border/50 focus:border-primary/50"
                  value={productData.description}
                  onChange={(e) =>
                    setProductData({ ...productData, description: e.target.value })
                  }
                  disabled={step !== "review"}
                />
              </CardContent>
            </Card>

            {/* Price & Category */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Preço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    variant="glass"
                    type="number"
                    step="0.01"
                    value={productData.price || ""}
                    onChange={(e) =>
                      setProductData({
                        ...productData,
                        price: parseFloat(e.target.value) || null,
                      })
                    }
                    disabled={step !== "review"}
                    placeholder="0.00"
                  />
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="h-5 w-5 text-primary" />
                    Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    variant="glass"
                    value={productData.category}
                    onChange={(e) =>
                      setProductData({ ...productData, category: e.target.value })
                    }
                    disabled={step !== "review"}
                    placeholder="Categoria do produto"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            {step === "review" && (
              <div className="flex gap-4">
                <Button variant="outline" className="flex-1" onClick={resetImport}>
                  <RefreshCw className="h-5 w-5" />
                  Começar Novamente
                </Button>
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handlePublish}
                  disabled={!productData.title || !productData.price}
                >
                  <Send className="h-5 w-5" />
                  Publicar no Mercado Livre
                </Button>
              </div>
            )}

            {step === "publishing" && (
              <Card variant="glass">
                <CardContent className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-4" />
                  <span className="text-lg">Publicando no Mercado Livre...</span>
                </CardContent>
              </Card>
            )}

            {step === "done" && (
              <Card variant="glass" className="border-success/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-success">
                    Produto publicado com sucesso!
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    O produto já está disponível na sua loja do Mercado Livre
                  </p>
                  {publishedItemId && (
                    <a
                      href={`https://www.mercadolivre.com.br/p/${publishedItemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex items-center gap-2 text-primary hover:underline"
                    >
                      Ver anúncio <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <Button className="mt-6" onClick={resetImport}>
                    Importar Outro Produto
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
