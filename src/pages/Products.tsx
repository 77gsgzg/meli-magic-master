import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProducts } from "@/hooks/useProducts";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<'products'>;
type ProductStatus = 'all' | 'draft' | 'pending' | 'published' | 'error' | 'paused';

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "pending" | "default" }> = {
  published: { label: "Publicado", variant: "success" },
  pending: { label: "Pendente", variant: "pending" },
  draft: { label: "Rascunho", variant: "default" },
  error: { label: "Erro", variant: "destructive" },
  paused: { label: "Pausado", variant: "warning" },
};

export default function Products() {
  const { products, loading, deleteProduct, fetchProducts } = useProducts();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  const handleDelete = async (product: Product) => {
    if (!confirm(`Tem certeza que deseja excluir "${product.title}"?`)) return;
    
    setDeletingId(product.id);
    const success = await deleteProduct(product.id);
    setDeletingId(null);
    
    if (success) {
      toast.success('Produto excluído com sucesso');
    }
  };

  const statusCounts = {
    all: products.length,
    draft: products.filter(p => p.status === 'draft').length,
    pending: products.filter(p => p.status === 'pending').length,
    published: products.filter(p => p.status === 'published').length,
    error: products.filter(p => p.status === 'error').length,
    paused: products.filter(p => p.status === 'paused').length,
  };

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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              variant="glass"
              placeholder="Buscar produtos..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => fetchProducts()}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Status Tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProductStatus)}>
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="all">
              Todos ({statusCounts.all})
            </TabsTrigger>
            <TabsTrigger value="published">
              Publicados ({statusCounts.published})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pendentes ({statusCounts.pending})
            </TabsTrigger>
            <TabsTrigger value="draft">
              Rascunhos ({statusCounts.draft})
            </TabsTrigger>
            <TabsTrigger value="error">
              Erros ({statusCounts.error})
            </TabsTrigger>
          </TabsList>
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
              <div className="overflow-x-auto">
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
                    {filteredProducts.map((product) => {
                      const imageUrl = getFirstImage(product.images);
                      const status = statusMap[product.status || 'draft'] || statusMap.draft;
                      
                      return (
                        <tr
                          key={product.id}
                          className={`border-b border-border/30 hover:bg-secondary/30 transition-colors ${
                            deletingId === product.id ? 'opacity-50' : ''
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
                                <p className="font-medium text-foreground line-clamp-1 max-w-xs">
                                  {product.title}
                                </p>
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
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Re-otimizar com IA
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDelete(product)}
                                  disabled={deletingId === product.id}
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
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
