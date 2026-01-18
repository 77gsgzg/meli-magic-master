import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Package,
  Loader2,
  ExternalLink,
  Sparkles,
  Settings2,
  DollarSign,
  TrendingUp,
  Download,
  CheckCircle2,
  AlertCircle,
  Store,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface SupplierProduct {
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  image: string | null;
  url: string;
  // Local modifications
  optimizedTitle?: string;
  optimizedDescription?: string;
  strategy?: string;
  margin?: number;
  targetPrice?: number;
  selected?: boolean;
}

interface ProductSettings {
  strategy: string;
  margin: number;
  targetPrice: number | null;
  positioning: number;
}

export default function SupplierPage() {
  const { loading: authLoading, session } = useRequireAuth();
  const [supplierUrl, setSupplierUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productSettings, setProductSettings] = useState<ProductSettings>({
    strategy: "balanced",
    margin: 30,
    targetPrice: null,
    positioning: 50,
  });
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  const handleScrapeSupplier = async () => {
    if (!supplierUrl.trim()) {
      toast.error("Digite a URL do fornecedor");
      return;
    }

    setIsLoading(true);
    setProducts([]);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-supplier", {
        body: { supplierUrl: supplierUrl.trim() },
      });

      if (error) throw error;

      if (data.success && data.products) {
        setProducts(data.products);
        setSupplierName(data.supplier_name || "Fornecedor");
        toast.success(`${data.products.length} produtos encontrados!`);
      } else {
        toast.error(data.error || "Erro ao buscar produtos");
      }
    } catch (error: any) {
      console.error("Error scraping supplier:", error);
      toast.error(error.message || "Erro ao acessar o fornecedor");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductClick = (product: SupplierProduct) => {
    setSelectedProduct(product);
    setGeneratedTitle(product.optimizedTitle || "");
    setGeneratedDescription(product.optimizedDescription || "");
    setProductSettings({
      strategy: product.strategy || "balanced",
      margin: product.margin || 30,
      targetPrice: product.targetPrice || null,
      positioning: 50,
    });
    setProductDialogOpen(true);
  };

  const handleGenerateBio = async () => {
    if (!selectedProduct) return;

    setIsGeneratingBio(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-optimize", {
        body: {
          title: selectedProduct.title,
          description: selectedProduct.description || "",
          category: "general",
        },
      });

      if (error) throw error;

      if (data.optimized_title) {
        setGeneratedTitle(data.optimized_title);
      }
      if (data.optimized_description) {
        setGeneratedDescription(data.optimized_description);
      }

      toast.success("Bio gerada com sucesso!");
    } catch (error: any) {
      console.error("Error generating bio:", error);
      if (error.message?.includes("429")) {
        toast.error("Limite de requisições atingido. Aguarde um momento.");
      } else if (error.message?.includes("402")) {
        toast.error("Créditos de IA esgotados.");
      } else {
        toast.error("Erro ao gerar bio");
      }
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const handleSaveProductSettings = () => {
    if (!selectedProduct) return;

    setProducts(prev =>
      prev.map(p =>
        p.url === selectedProduct.url
          ? {
              ...p,
              optimizedTitle: generatedTitle || undefined,
              optimizedDescription: generatedDescription || undefined,
              strategy: productSettings.strategy,
              margin: productSettings.margin,
              targetPrice: productSettings.targetPrice || undefined,
            }
          : p
      )
    );

    toast.success("Configurações salvas!");
    setProductDialogOpen(false);
  };

  const handleToggleSelect = (url: string) => {
    setProducts(prev =>
      prev.map(p =>
        p.url === url ? { ...p, selected: !p.selected } : p
      )
    );
  };

  const handleSelectAll = () => {
    const allSelected = products.every(p => p.selected);
    setProducts(prev =>
      prev.map(p => ({ ...p, selected: !allSelected }))
    );
  };

  const handleBulkApply = async () => {
    const selectedProducts = products.filter(p => p.selected);
    if (selectedProducts.length === 0) {
      toast.error("Selecione pelo menos um produto");
      return;
    }

    setIsApplyingBulk(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const product of selectedProducts) {
        try {
          const { data, error } = await supabase.functions.invoke("ai-optimize", {
            body: {
              title: product.title,
              description: product.description || "",
            },
          });

          if (!error && data.optimized_title) {
            setProducts(prev =>
              prev.map(p =>
                p.url === product.url
                  ? {
                      ...p,
                      optimizedTitle: data.optimized_title,
                      optimizedDescription: data.optimized_description,
                    }
                  : p
              )
            );
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (successCount > 0) {
        toast.success(`${successCount} produtos otimizados!`);
      }
      if (errorCount > 0) {
        toast.warning(`${errorCount} produtos não puderam ser otimizados`);
      }
    } catch (error) {
      console.error("Bulk apply error:", error);
      toast.error("Erro ao aplicar em massa");
    } finally {
      setIsApplyingBulk(false);
    }
  };

  const selectedCount = products.filter(p => p.selected).length;
  const optimizedCount = products.filter(p => p.optimizedTitle).length;

  if (authLoading) {
    return (
      <DashboardLayout title="Fornecedor" subtitle="Carregando...">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Fornecedor"
      subtitle="Importe e gerencie produtos de fornecedores externos"
    >
      {/* Search Card */}
      <Card className="glass border-border/50 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Importar Produtos do Fornecedor
          </CardTitle>
          <CardDescription>
            Digite a URL da loja ou página de produtos do fornecedor para extrair automaticamente todos os itens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="https://www.fornecedor.com.br/produtos"
                value={supplierUrl}
                onChange={(e) => setSupplierUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScrapeSupplier()}
              />
            </div>
            <Button onClick={handleScrapeSupplier} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Produtos
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {products.length > 0 && (
        <>
          {/* Stats and Actions Bar */}
          <Card className="glass border-border/50 mb-6">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Fornecedor</p>
                    <p className="font-semibold capitalize">{supplierName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Produtos</p>
                    <p className="font-semibold">{products.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Otimizados</p>
                    <p className="font-semibold text-green-500">{optimizedCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Selecionados</p>
                    <p className="font-semibold text-primary">{selectedCount}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {products.every(p => p.selected) ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkApply}
                    disabled={selectedCount === 0 || isApplyingBulk}
                  >
                    {isApplyingBulk ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Aplicando...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Gerar Bio em Massa ({selectedCount})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <Card
                key={product.url}
                className={`glass border-border/50 cursor-pointer transition-all hover:border-primary/50 ${
                  product.selected ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardContent className="p-0">
                  {/* Image */}
                  <div className="relative aspect-square bg-muted">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}

                    {/* Selection checkbox overlay */}
                    <div
                      className="absolute top-2 left-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(product.url);
                      }}
                    >
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          product.selected
                            ? "bg-primary border-primary"
                            : "bg-background/80 border-border"
                        }`}
                      >
                        {product.selected && (
                          <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Optimized badge */}
                    {product.optimizedTitle && (
                      <Badge className="absolute top-2 right-2 bg-green-500">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Otimizado
                      </Badge>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4" onClick={() => handleProductClick(product)}>
                    <h3 className="font-medium text-sm line-clamp-2 mb-2">
                      {product.optimizedTitle || product.title}
                    </h3>

                    <div className="flex items-center justify-between">
                      {product.price ? (
                        <p className="text-lg font-bold text-primary">
                          R$ {product.price.toFixed(2)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Preço não disponível</p>
                      )}

                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    {product.strategy && (
                      <Badge variant="outline" className="mt-2">
                        {product.strategy === "fast" && "Vender Rápido"}
                        {product.strategy === "balanced" && "Equilibrado"}
                        {product.strategy === "margin" && "Maior Margem"}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!isLoading && products.length === 0 && (
        <Card className="glass border-border/50">
          <CardContent className="py-16 text-center">
            <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum produto carregado</h3>
            <p className="text-muted-foreground mb-4">
              Digite a URL de um fornecedor para importar produtos
            </p>
            <p className="text-sm text-muted-foreground">
              Exemplo: https://www.utimix.com/?s=Casa&post_type=product
            </p>
          </CardContent>
        </Card>
      )}

      {/* Product Edit Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Produto</DialogTitle>
            <DialogDescription>
              Ajuste as configurações de venda e gere uma nova bio com IA
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-6">
              {/* Product Preview */}
              <div className="flex gap-4">
                {selectedProduct.image && (
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.title}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-medium">{selectedProduct.title}</h3>
                  {selectedProduct.price && (
                    <p className="text-primary font-bold">
                      R$ {selectedProduct.price.toFixed(2)}
                    </p>
                  )}
                  <a
                    href={selectedProduct.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    Ver original <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Strategy */}
              <div className="space-y-2">
                <Label>Estratégia de Venda</Label>
                <Select
                  value={productSettings.strategy}
                  onValueChange={(v) => setProductSettings(prev => ({ ...prev, strategy: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                        Vender Rápido (menor margem)
                      </div>
                    </SelectItem>
                    <SelectItem value="balanced">
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-blue-500" />
                        Equilibrado
                      </div>
                    </SelectItem>
                    <SelectItem value="margin">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        Maior Margem
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Margin */}
              <div className="space-y-2">
                <Label>Margem Desejada: {productSettings.margin}%</Label>
                <Slider
                  value={[productSettings.margin]}
                  onValueChange={([v]) => setProductSettings(prev => ({ ...prev, margin: v }))}
                  min={5}
                  max={100}
                  step={5}
                />
              </div>

              {/* Target Price */}
              <div className="space-y-2">
                <Label>Preço Alvo (opcional)</Label>
                <Input
                  type="number"
                  placeholder="R$ 0,00"
                  value={productSettings.targetPrice || ""}
                  onChange={(e) =>
                    setProductSettings(prev => ({
                      ...prev,
                      targetPrice: e.target.value ? parseFloat(e.target.value) : null,
                    }))
                  }
                />
              </div>

              {/* Positioning */}
              <div className="space-y-2">
                <Label>
                  Posicionamento:{" "}
                  {productSettings.positioning < 30
                    ? "Conservador"
                    : productSettings.positioning > 70
                    ? "Agressivo"
                    : "Moderado"}
                </Label>
                <Slider
                  value={[productSettings.positioning]}
                  onValueChange={([v]) => setProductSettings(prev => ({ ...prev, positioning: v }))}
                  min={0}
                  max={100}
                  step={10}
                />
                <p className="text-xs text-muted-foreground">
                  Define a intensidade das otimizações e posicionamento no marketplace
                </p>
              </div>

              {/* AI Bio Generation */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Bio Otimizada (IA)</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateBio}
                    disabled={isGeneratingBio}
                  >
                    {isGeneratingBio ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Gerar Bio Nova (IA)
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Título Otimizado</Label>
                  <Input
                    value={generatedTitle}
                    onChange={(e) => setGeneratedTitle(e.target.value)}
                    placeholder="Clique em 'Gerar Bio Nova' para criar"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição Otimizada</Label>
                  <Textarea
                    value={generatedDescription}
                    onChange={(e) => setGeneratedDescription(e.target.value)}
                    placeholder="Clique em 'Gerar Bio Nova' para criar"
                    rows={5}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProductSettings}>Salvar Configurações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
