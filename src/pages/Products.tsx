import { useState, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeIndicator } from "@/components/ui/SwipeIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeTabs } from "@/hooks/useSwipeTabs";
import {
  Search,
  MoreVertical,
  ExternalLink,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  Package,
  ShoppingCart,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProducts } from "@/hooks/useProducts";
import { useProductRealtime } from "@/hooks/useProductRealtime";
import { useAIOptimize } from "@/hooks/useAIOptimize";
import { EditProductModal } from "@/components/products/EditProductModal";
import { exportToCSV, exportToExcel } from "@/utils/exportProducts";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<'products'>;
type ProductStatus = 'all' | 'draft' | 'pending' | 'published' | 'error' | 'paused';

const ITEMS_PER_PAGE = 10;

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "pending" | "default" }> = {
  published: { label: "Publicado", variant: "success" },
  pending: { label: "Pendente", variant: "pending" },
  draft: { label: "Rascunho", variant: "default" },
  error: { label: "Erro", variant: "destructive" },
  paused: { label: "Pausado", variant: "warning" },
};

export default function Products() {
  const { products, loading, deleteProduct, updateProduct, fetchProducts } = useProducts();
  const { optimizeProduct, loading: optimizing } = useAIOptimize();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Real-time updates
  const handleProductUpdated = useCallback((updatedProduct: Product) => {
    fetchProducts();
  }, [fetchProducts]);

  const handleProductInserted = useCallback(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleProductDeleted = useCallback(() => {
    fetchProducts();
  }, [fetchProducts]);

  useProductRealtime({
    onProductUpdated: handleProductUpdated,
    onProductInserted: handleProductInserted,
    onProductDeleted: handleProductDeleted,
  });

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Reset page when filters change
  const handleStatusChange = (value: string) => {
    setStatusFilter(value as ProductStatus);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const getFirstImage = (images: unknown): string | null => {
    if (Array.isArray(images) && images.length > 0) {
      const first = images[0];
      if (typeof first === 'string') return first;
      if (typeof first === 'object' && first && 'url' in first) return (first as { url: string }).url;
    }
    return null;
  };

  const formatPrice = (price: number | null, currency: string | null) => {
    if (!price) return "—";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL'
    }).format(price);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (id: string, updates: Parameters<typeof updateProduct>[1]) => {
    const result = await updateProduct(id, updates);
    if (result) {
      toast.success('Produto atualizado com sucesso!');
    }
    return result;
  };

  const handleReOptimize = async (product: Product) => {
    setOptimizingId(product.id);
    
    try {
      const result = await optimizeProduct(
        product.original_title || product.title,
        product.original_description || product.description || undefined,
        product.category_name || undefined,
        (product.attributes as Record<string, unknown>[]) || undefined
      );

      if (result) {
        await updateProduct(product.id, {
          title: result.optimized_title,
          description: result.optimized_description,
          ai_optimized: true,
        });

        toast.success('Produto re-otimizado com sucesso!');
        await fetchProducts();
      }
    } catch (error) {
      console.error('Re-optimization error:', error);
      toast.error('Erro ao re-otimizar produto');
    } finally {
      setOptimizingId(null);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Tem certeza que deseja excluir "${product.title}"?`)) return;
    
    setDeletingId(product.id);
    const success = await deleteProduct(product.id);
    setDeletingId(null);
    
    if (success) {
      // Adjust page if needed
      const newTotal = Math.ceil((filteredProducts.length - 1) / ITEMS_PER_PAGE);
      if (currentPage > newTotal && newTotal > 0) {
        setCurrentPage(newTotal);
      }
    }
  };

  const handleExportCSV = () => {
    if (filteredProducts.length === 0) {
      toast.error('Nenhum produto para exportar');
      return;
    }
    exportToCSV(filteredProducts);
    toast.success(`${filteredProducts.length} produtos exportados para CSV`);
  };

  const handleExportExcel = () => {
    if (filteredProducts.length === 0) {
      toast.error('Nenhum produto para exportar');
      return;
    }
    exportToExcel(filteredProducts);
    toast.success(`${filteredProducts.length} produtos exportados para Excel`);
  };

  const statusCounts = {
    all: products.length,
    draft: products.filter(p => p.status === 'draft').length,
    pending: products.filter(p => p.status === 'pending').length,
    published: products.filter(p => p.status === 'published').length,
    error: products.filter(p => p.status === 'error').length,
    paused: products.filter(p => p.status === 'paused').length,
  };

  const STATUS_TABS = ["all", "published", "pending", "draft", "error", "paused"] as const;
  const swipeHandlers = useSwipeTabs({
    tabs: STATUS_TABS,
    value: statusFilter as (typeof STATUS_TABS)[number],
    onValueChange: (v) => handleStatusChange(v),
    enabled: isMobile,
  });

  if (loading) {
    return (
      <DashboardLayout
        title="Produtos"
        subtitle="Gerencie todos os seus produtos publicados"
      >
        <div className="space-y-6">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-12 w-full" />
          <Card variant="glass">
            <CardContent className="p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full mb-4" />
              ))}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Produtos"
      subtitle="Gerencie todos os seus produtos publicados"
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              variant="glass"
              placeholder="Buscar produtos..."
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass">
                <DropdownMenuItem onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="h-9" onClick={() => fetchProducts()}>
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Atualizar</span>
            </Button>
          </div>
        </div>

        {/* Status Tabs */}
        <Tabs value={statusFilter} onValueChange={handleStatusChange} {...swipeHandlers}>
          <TabsList className="bg-secondary/50 w-full flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="all" className="text-xs sm:text-sm flex-1 sm:flex-none">
              Todos ({statusCounts.all})
            </TabsTrigger>
            <TabsTrigger value="published" className="text-xs sm:text-sm flex-1 sm:flex-none">
              <span className="hidden sm:inline">Publicados</span>
              <span className="sm:hidden">Pub.</span>
              ({statusCounts.published})
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs sm:text-sm flex-1 sm:flex-none">
              <span className="hidden sm:inline">Pendentes</span>
              <span className="sm:hidden">Pend.</span>
              ({statusCounts.pending})
            </TabsTrigger>
            <TabsTrigger value="draft" className="text-xs sm:text-sm flex-1 sm:flex-none">
              <span className="hidden sm:inline">Rascunhos</span>
              <span className="sm:hidden">Rasc.</span>
              ({statusCounts.draft})
            </TabsTrigger>
            <TabsTrigger value="error" className="text-xs sm:text-sm flex-1 sm:flex-none">
              Erros ({statusCounts.error})
            </TabsTrigger>
            <TabsTrigger value="paused" className="text-xs sm:text-sm flex-1 sm:flex-none">
              <span className="hidden sm:inline">Pausados</span>
              <span className="sm:hidden">Paus.</span>
              ({statusCounts.paused})
            </TabsTrigger>
          </TabsList>
          {isMobile && (
            <SwipeIndicator
              currentIndex={STATUS_TABS.indexOf(statusFilter as (typeof STATUS_TABS)[number])}
              totalTabs={STATUS_TABS.length}
              tabLabels={["Todos", "Pub.", "Pend.", "Rasc.", "Erros", "Paus."]}
            />
          )}
        </Tabs>

        {/* Products Table */}
        {filteredProducts.length === 0 ? (
          <Card variant="glass">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {products.length === 0 ? "Nenhum produto ainda" : "Nenhum produto encontrado"}
                </h3>
                <p className="text-muted-foreground">
                  {products.length === 0 
                    ? "Importe seu primeiro produto para começar"
                    : "Tente ajustar os filtros de busca"
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card variant="glass">
            <CardContent className="p-0">
              {/* Mobile Card View */}
              <div className="block md:hidden divide-y divide-border/30">
                {paginatedProducts.map((product) => {
                  const imageUrl = getFirstImage(product.images);
                  const status = statusMap[product.status || 'draft'] || statusMap.draft;
                  const isOptimizing = optimizingId === product.id;
                  const isDeleting = deletingId === product.id;
                  
                  return (
                    <div
                      key={product.id}
                      className={`p-4 ${isDeleting || isOptimizing ? 'opacity-50' : ''}`}
                    >
                      <div className="flex gap-3">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.title}
                            className="h-16 w-16 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground line-clamp-2 text-sm">
                                {product.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {product.ai_optimized && (
                                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-[10px] px-1.5 py-0">
                                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                    IA
                                  </Badge>
                                )}
                                <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                                  {status.label}
                                </Badge>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="glass">
                                {product.ml_permalink && (
                                  <DropdownMenuItem asChild>
                                    <a href={product.ml_permalink} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Ver no ML
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleEdit(product)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReOptimize(product)} disabled={isOptimizing}>
                                  {isOptimizing ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                  )}
                                  Re-otimizar IA
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(product)}
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 mr-2" />
                                  )}
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {formatPrice(product.price, product.currency)}
                            </span>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {product.available_quantity || 0}
                              </div>
                              <div className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {product.views || 0}
                              </div>
                              <div className="flex items-center gap-1">
                                <ShoppingCart className="h-3 w-3" />
                                {product.sales || 0}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                        Produto
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                        Preço
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                        Estoque
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                        Métricas
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product) => {
                      const imageUrl = getFirstImage(product.images);
                      const status = statusMap[product.status || 'draft'] || statusMap.draft;
                      const isOptimizing = optimizingId === product.id;
                      const isDeleting = deletingId === product.id;
                      
                      return (
                        <tr
                          key={product.id}
                          className={`border-b border-border/30 hover:bg-secondary/30 transition-colors ${
                            isDeleting || isOptimizing ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={product.title}
                                  className="h-16 w-16 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                                  <Package className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground line-clamp-1 max-w-xs">
                                    {product.title}
                                  </p>
                                  {product.ai_optimized && (
                                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                                      <Sparkles className="h-3 w-3 mr-1" />
                                      IA
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {product.ml_item_id || product.id.slice(0, 8)} • {
                                    formatDistanceToNow(new Date(product.updated_at), {
                                      addSuffix: true,
                                      locale: ptBR
                                    })
                                  }
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={status.variant}>
                              {status.label}
                            </Badge>
                            {product.error_message && (
                              <p className="text-xs text-destructive mt-1 max-w-32 truncate" title={product.error_message}>
                                {product.error_message}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-foreground">
                              {formatPrice(product.price, product.currency)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span
                                className={
                                  (product.available_quantity || 0) <= 5
                                    ? "text-warning"
                                    : "text-foreground"
                                }
                              >
                                {product.available_quantity || 0} un.
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                {product.views || 0}
                              </div>
                              <div className="flex items-center gap-1">
                                <ShoppingCart className="h-4 w-4" />
                                {product.sales || 0}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="glass">
                                {product.ml_permalink && (
                                  <DropdownMenuItem onClick={() => window.open(product.ml_permalink!, '_blank')}>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Ver no ML
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleEdit(product)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleReOptimize(product)}
                                  disabled={isOptimizing || optimizing}
                                >
                                  {isOptimizing ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4 mr-2" />
                                  )}
                                  {isOptimizing ? 'Otimizando...' : 'Re-otimizar com IA'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDelete(product)}
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} de{' '}
                    {filteredProducts.length} produtos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Modal */}
      <EditProductModal
        product={editingProduct}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={handleSaveEdit}
      />
    </DashboardLayout>
  );
}
