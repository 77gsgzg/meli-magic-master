import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Search,
  Package,
  Loader2,
  ExternalLink,
  Sparkles,
  Settings2,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Store,
  Wand2,
  Save,
  Upload,
  Trash2,
  History,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { SupplierPublicationHistory } from "@/components/supplier/SupplierPublicationHistory";
import { BulkPublishProgress } from "@/components/supplier/BulkPublishProgress";
import { PriceSyncManager } from "@/components/supplier/PriceSyncManager";

interface SupplierProduct {
  id?: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  product_url: string;
  supplier_name: string;
  supplier_url: string;
  optimized_title?: string | null;
  optimized_description?: string | null;
  strategy?: string;
  margin?: number;
  target_price?: number | null;
  positioning?: string;
  is_published?: boolean;
  ml_item_id?: string | null;
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
  const { connection: mlConnection, callMLApi } = useMercadoLivre();
  const [supplierUrl, setSupplierUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [savedProducts, setSavedProducts] = useState<SupplierProduct[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
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
  const [viewMode, setViewMode] = useState<"import" | "saved">("import");
  const [activeTab, setActiveTab] = useState<"products" | "bulk" | "sync" | "history">("products");

  // Load saved products from database
  useEffect(() => {
    if (session?.user?.id) {
      loadSavedProducts();
    }
  }, [session?.user?.id]);

  const loadSavedProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("supplier_products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setSavedProducts(data?.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price ? Number(p.price) : null,
        currency: p.currency || "BRL",
        image_url: p.image_url,
        product_url: p.product_url || "",
        supplier_name: p.supplier_name,
        supplier_url: p.supplier_url || "",
        optimized_title: p.optimized_title,
        optimized_description: p.optimized_description,
        strategy: p.strategy || "balanced",
        margin: p.margin ? Number(p.margin) : 30,
        target_price: p.target_price ? Number(p.target_price) : null,
        positioning: p.positioning || "moderate",
        is_published: p.is_published || false,
        ml_item_id: p.ml_item_id,
      })) || []);
    } catch (error) {
      console.error("Error loading saved products:", error);
    }
  };

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
        const mappedProducts: SupplierProduct[] = data.products.map((p: any) => ({
          title: p.title,
          description: p.description,
          price: p.price,
          currency: p.currency || "BRL",
          image_url: p.image,
          product_url: p.url,
          supplier_name: data.supplier_name || "Fornecedor",
          supplier_url: supplierUrl.trim(),
        }));
        setProducts(mappedProducts);
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

  const handleSaveProducts = async () => {
    const selectedProducts = products.filter(p => p.selected);
    if (selectedProducts.length === 0) {
      toast.error("Selecione pelo menos um produto para salvar");
      return;
    }

    setIsSaving(true);

    try {
      const productsToSave = selectedProducts.map(p => ({
        user_id: session!.user.id,
        supplier_name: p.supplier_name,
        supplier_url: p.supplier_url,
        title: p.title,
        description: p.description,
        price: p.price,
        currency: p.currency,
        image_url: p.image_url,
        product_url: p.product_url,
        optimized_title: p.optimized_title,
        optimized_description: p.optimized_description,
        strategy: p.strategy || "balanced",
        margin: p.margin || 30,
        target_price: p.target_price,
        positioning: p.positioning || "moderate",
      }));

      const { error } = await supabase
        .from("supplier_products")
        .insert(productsToSave);

      if (error) throw error;

      toast.success(`${selectedProducts.length} produtos salvos com sucesso!`);
      await loadSavedProducts();
      
      // Clear selection
      setProducts(prev => prev.map(p => ({ ...p, selected: false })));
    } catch (error: any) {
      console.error("Error saving products:", error);
      toast.error("Erro ao salvar produtos");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from("supplier_products")
        .delete()
        .eq("id", productId);

      if (error) throw error;

      toast.success("Produto removido!");
      setSavedProducts(prev => prev.filter(p => p.id !== productId));
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Erro ao remover produto");
    }
  };

  const handleProductClick = (product: SupplierProduct) => {
    setSelectedProduct(product);
    setGeneratedTitle(product.optimized_title || "");
    setGeneratedDescription(product.optimized_description || "");
    setProductSettings({
      strategy: product.strategy || "balanced",
      margin: product.margin || 30,
      targetPrice: product.target_price || null,
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

  const handleSaveProductSettings = async () => {
    if (!selectedProduct) return;

    const updatedProduct = {
      ...selectedProduct,
      optimized_title: generatedTitle || null,
      optimized_description: generatedDescription || null,
      strategy: productSettings.strategy,
      margin: productSettings.margin,
      target_price: productSettings.targetPrice,
    };

    // If it's a saved product, update in database
    if (selectedProduct.id) {
      try {
        const { error } = await supabase
          .from("supplier_products")
          .update({
            optimized_title: updatedProduct.optimized_title,
            optimized_description: updatedProduct.optimized_description,
            strategy: updatedProduct.strategy,
            margin: updatedProduct.margin,
            target_price: updatedProduct.target_price,
          })
          .eq("id", selectedProduct.id);

        if (error) throw error;

        setSavedProducts(prev =>
          prev.map(p => p.id === selectedProduct.id ? updatedProduct : p)
        );
        toast.success("Configurações salvas no banco de dados!");
      } catch (error) {
        console.error("Error updating product:", error);
        toast.error("Erro ao salvar configurações");
        return;
      }
    } else {
      // Update local state for imported products
      setProducts(prev =>
        prev.map(p =>
          p.product_url === selectedProduct.product_url ? updatedProduct : p
        )
      );
      toast.success("Configurações salvas!");
    }

    setProductDialogOpen(false);
  };

  const handlePublishToML = async () => {
    if (!selectedProduct) return;
    
    if (!mlConnection.connected) {
      toast.error("Conecte sua conta do Mercado Livre primeiro");
      return;
    }

    setIsPublishing(true);

    try {
      const title = selectedProduct.optimized_title || selectedProduct.title;
      const description = selectedProduct.optimized_description || selectedProduct.description || "";
      const price = selectedProduct.target_price || 
        (selectedProduct.price ? selectedProduct.price * (1 + (selectedProduct.margin || 30) / 100) : 100);

      // Create product in our database first
      const { data: productData, error: productError } = await supabase
        .from("products")
        .insert({
          user_id: session!.user.id,
          title: title,
          description: description,
          price: price,
          currency: selectedProduct.currency,
          images: selectedProduct.image_url ? [{ url: selectedProduct.image_url }] : [],
          source_url: selectedProduct.product_url,
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
        images: selectedProduct.image_url ? [selectedProduct.image_url] : [],
      });

      // Update supplier product with ML info
      if (selectedProduct.id) {
        await supabase
          .from("supplier_products")
          .update({
            is_published: true,
            published_product_id: productData.id,
            ml_item_id: mlResult?.ml_item_id || null,
          })
          .eq("id", selectedProduct.id);

        setSavedProducts(prev =>
          prev.map(p =>
            p.id === selectedProduct.id
              ? { ...p, is_published: true, ml_item_id: mlResult?.ml_item_id }
              : p
          )
        );
      }

      toast.success("Produto publicado no Mercado Livre!");
      setPublishDialogOpen(false);
      setProductDialogOpen(false);
    } catch (error: any) {
      console.error("Error publishing to ML:", error);
      toast.error(error.message || "Erro ao publicar no Mercado Livre");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleSelect = (url: string) => {
    if (viewMode === "import") {
      setProducts(prev =>
        prev.map(p => p.product_url === url ? { ...p, selected: !p.selected } : p)
      );
    } else {
      setSavedProducts(prev =>
        prev.map(p => p.product_url === url ? { ...p, selected: !p.selected } : p)
      );
    }
  };

  const handleSelectAll = () => {
    if (viewMode === "import") {
      const allSelected = products.every(p => p.selected);
      setProducts(prev => prev.map(p => ({ ...p, selected: !allSelected })));
    } else {
      const allSelected = savedProducts.every(p => p.selected);
      setSavedProducts(prev => prev.map(p => ({ ...p, selected: !allSelected })));
    }
  };

  const handleBulkApply = async () => {
    const targetProducts = viewMode === "import" ? products : savedProducts;
    const selectedProducts = targetProducts.filter(p => p.selected);
    
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
            const updatedProduct = {
              ...product,
              optimized_title: data.optimized_title,
              optimized_description: data.optimized_description,
            };

            if (product.id) {
              // Update in database
              await supabase
                .from("supplier_products")
                .update({
                  optimized_title: data.optimized_title,
                  optimized_description: data.optimized_description,
                })
                .eq("id", product.id);
            }

            if (viewMode === "import") {
              setProducts(prev =>
                prev.map(p => p.product_url === product.product_url ? updatedProduct : p)
              );
            } else {
              setSavedProducts(prev =>
                prev.map(p => p.id === product.id ? updatedProduct : p)
              );
            }
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }

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

  const displayProducts = viewMode === "import" ? products : savedProducts;
  const selectedCount = displayProducts.filter(p => p.selected).length;
  const optimizedCount = displayProducts.filter(p => p.optimized_title).length;
  const publishedCount = savedProducts.filter(p => p.is_published).length;

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
      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Produtos</span>
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Publicação em Massa</span>
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Sincronização</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "products" && (
        <>
          {/* View Toggle */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={viewMode === "import" ? "default" : "outline"}
              onClick={() => setViewMode("import")}
            >
              <Search className="h-4 w-4 mr-2" />
              Importar Novos
            </Button>
            <Button
              variant={viewMode === "saved" ? "default" : "outline"}
              onClick={() => setViewMode("saved")}
            >
              <History className="h-4 w-4 mr-2" />
              Produtos Salvos ({savedProducts.length})
            </Button>
          </div>

      {viewMode === "import" && (
        <>
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
        </>
      )}

      {/* Products Grid */}
      {displayProducts.length > 0 && (
        <>
          {/* Stats and Actions Bar */}
          <Card className="glass border-border/50 mb-6">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  {viewMode === "import" && (
                    <div>
                      <p className="text-sm text-muted-foreground">Fornecedor</p>
                      <p className="font-semibold capitalize">{supplierName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Produtos</p>
                    <p className="font-semibold">{displayProducts.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Otimizados</p>
                    <p className="font-semibold text-green-500">{optimizedCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Selecionados</p>
                    <p className="font-semibold text-primary">{selectedCount}</p>
                  </div>
                  {viewMode === "saved" && (
                    <div>
                      <p className="text-sm text-muted-foreground">Publicados</p>
                      <p className="font-semibold text-blue-500">{publishedCount}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {displayProducts.every(p => p.selected) ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
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
                        Gerar Bio ({selectedCount})
                      </>
                    )}
                  </Button>
                  {viewMode === "import" && (
                    <Button
                      size="sm"
                      onClick={handleSaveProducts}
                      disabled={selectedCount === 0 || isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Salvar ({selectedCount})
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayProducts.map((product) => (
              <Card
                key={product.id || product.product_url}
                className={`glass border-border/50 cursor-pointer transition-all hover:border-primary/50 ${
                  product.selected ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardContent className="p-0">
                  {/* Image */}
                  <div className="relative aspect-square bg-muted">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
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
                        handleToggleSelect(product.product_url);
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

                    {/* Status badges */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {product.optimized_title && (
                        <Badge className="bg-green-500">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Otimizado
                        </Badge>
                      )}
                      {product.is_published && (
                        <Badge className="bg-blue-500">
                          <Upload className="h-3 w-3 mr-1" />
                          Publicado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4" onClick={() => handleProductClick(product)}>
                    <h3 className="font-medium text-sm line-clamp-2 mb-2">
                      {product.optimized_title || product.title}
                    </h3>

                    <div className="flex items-center justify-between">
                      {product.price ? (
                        <p className="text-lg font-bold text-primary">
                          R$ {product.price.toFixed(2)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Preço não disponível</p>
                      )}

                      <div className="flex items-center gap-2">
                        {viewMode === "saved" && product.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSavedProduct(product.id!);
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <a
                          href={product.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
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
      {!isLoading && displayProducts.length === 0 && (
        <Card className="glass border-border/50">
          <CardContent className="py-16 text-center">
            <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {viewMode === "import" ? "Nenhum produto carregado" : "Nenhum produto salvo"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {viewMode === "import"
                ? "Digite a URL de um fornecedor para importar produtos"
                : "Importe e salve produtos de fornecedores para ver aqui"}
            </p>
            {viewMode === "import" && (
              <p className="text-sm text-muted-foreground">
                Exemplo: https://www.utimix.com/?s=Casa&post_type=product
              </p>
            )}
          </CardContent>
        </Card>
      )}
        </>
      )}

      {activeTab === "bulk" && (
        <BulkPublishProgress
          products={savedProducts.filter(p => p.id && p.selected && !p.is_published).map(p => ({ ...p, id: p.id! }))}
          userId={session?.user?.id || ""}
          onComplete={loadSavedProducts}
          callMLApi={callMLApi}
        />
      )}

      {activeTab === "sync" && (
        <PriceSyncManager userId={session?.user?.id || ""} />
      )}

      {activeTab === "history" && (
        <SupplierPublicationHistory userId={session?.user?.id || ""} />
      )}

      {/* Product Edit Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Produto</DialogTitle>
            <DialogDescription>
              Ajuste as configurações de venda, gere uma nova bio com IA ou publique no Mercado Livre
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-6">
              {/* Product Preview */}
              <div className="flex gap-4">
                {selectedProduct.image_url && (
                  <img
                    src={selectedProduct.image_url}
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
                    href={selectedProduct.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    Ver original <ExternalLink className="h-3 w-3" />
                  </a>
                  {selectedProduct.is_published && (
                    <Badge className="mt-2 bg-blue-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Publicado no ML
                    </Badge>
                  )}
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProductSettings}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações
            </Button>
            {selectedProduct?.id && mlConnection.connected && !selectedProduct.is_published && (
              <Button
                variant="default"
                className="bg-yellow-500 hover:bg-yellow-600"
                onClick={() => setPublishDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Publicar no ML
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar no Mercado Livre?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedProduct && (
                <div className="space-y-2">
                  <p>Você está prestes a publicar o produto:</p>
                  <p className="font-medium">
                    {selectedProduct.optimized_title || selectedProduct.title}
                  </p>
                  <p>
                    Preço de venda:{" "}
                    <span className="font-medium text-primary">
                      R${" "}
                      {(
                        selectedProduct.target_price ||
                        (selectedProduct.price
                          ? selectedProduct.price * (1 + (selectedProduct.margin || 30) / 100)
                          : 100)
                      ).toFixed(2)}
                    </span>
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublishToML}
              disabled={isPublishing}
              className="bg-yellow-500 hover:bg-yellow-600"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Confirmar Publicação
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
