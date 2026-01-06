import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";

type ImportStep = "input" | "extracting" | "optimizing" | "review" | "publishing" | "done";

export default function Import() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<ImportStep>("input");
  const [productData, setProductData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    images: [] as string[],
  });

  const simulateExtraction = async () => {
    setStep("extracting");
    await new Promise((r) => setTimeout(r, 2000));
    
    setProductData({
      title: "Fone de Ouvido Bluetooth Premium com Cancelamento de Ruído Ativo",
      description: "Fone de ouvido wireless com tecnologia de cancelamento de ruído ativo, bateria de longa duração e conforto excepcional para uso prolongado.",
      price: "R$ 459,90",
      category: "Eletrônicos > Áudio > Fones de Ouvido",
      images: [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop",
        "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&h=400&fit=crop",
        "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&h=400&fit=crop",
      ],
    });
    
    setStep("optimizing");
    await new Promise((r) => setTimeout(r, 2500));
    
    setProductData((prev) => ({
      ...prev,
      title: "Fone Bluetooth Premium ANC | Cancelamento de Ruído | 40h Bateria | Conforto Superior",
      description: `🎧 FONE DE OUVIDO BLUETOOTH PREMIUM COM CANCELAMENTO DE RUÍDO ATIVO

✅ CARACTERÍSTICAS PRINCIPAIS:
• Cancelamento de Ruído Ativo (ANC) - Isole-se do mundo
• Bateria de 40 horas - Use o dia todo sem preocupação
• Bluetooth 5.3 - Conexão estável e alcance de 15m
• Drivers de 40mm - Som Hi-Fi cristalino
• Design ergonômico - Conforto para uso prolongado

📦 O QUE ESTÁ INCLUÍDO:
• 1x Fone de Ouvido Bluetooth
• 1x Cabo USB-C para carregamento
• 1x Cabo auxiliar 3.5mm
• 1x Case de transporte premium
• 1x Manual de instruções

🛡️ GARANTIA: 12 meses direto com o vendedor

💬 Dúvidas? Pergunte antes de comprar!`,
    }));
    
    setStep("review");
  };

  const handlePublish = async () => {
    setStep("publishing");
    await new Promise((r) => setTimeout(r, 2000));
    setStep("done");
  };

  const resetImport = () => {
    setUrl("");
    setStep("input");
    setProductData({
      title: "",
      description: "",
      price: "",
      category: "",
      images: [],
    });
  };

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
          ].map((s, i, arr) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                  step === s.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : ["extracting", "optimizing", "review", "publishing", "done"].indexOf(step) >
                      ["input", "extracting", "optimizing", "review", "publishing"].indexOf(s.id)
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-muted bg-muted/50 text-muted-foreground"
                }`}
              >
                {["extracting", "optimizing", "review", "publishing", "done"].indexOf(step) >
                ["input", "extracting", "optimizing", "review", "publishing"].indexOf(s.id) ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  i + 1
                )}
              </div>
              {i < arr.length - 1 && (
                <div
                  className={`h-0.5 w-16 mx-2 transition-all ${
                    ["extracting", "optimizing", "review", "publishing", "done"].indexOf(step) > i
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
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
                onClick={simulateExtraction}
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

        {/* Review Step */}
        {(step === "review" || step === "publishing" || step === "done") && (
          <div className="space-y-6 animate-fade-in">
            {/* Images */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Image className="h-5 w-5 text-primary" />
                  Imagens do Produto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {productData.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`Imagem ${i + 1}`}
                      className="h-32 w-32 rounded-lg object-cover border border-border"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Title */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-primary" />
                  Título Otimizado
                  <Badge variant="success" className="ml-auto">IA</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  variant="glass"
                  value={productData.title}
                  onChange={(e) => setProductData({ ...productData, title: e.target.value })}
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
                  <Badge variant="success" className="ml-auto">IA</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[300px] glass border-border/50 focus:border-primary/50"
                  value={productData.description}
                  onChange={(e) => setProductData({ ...productData, description: e.target.value })}
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
                    value={productData.price}
                    onChange={(e) => setProductData({ ...productData, price: e.target.value })}
                    disabled={step !== "review"}
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
                    onChange={(e) => setProductData({ ...productData, category: e.target.value })}
                    disabled={step !== "review"}
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
                <Button className="flex-1" size="lg" onClick={handlePublish}>
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
