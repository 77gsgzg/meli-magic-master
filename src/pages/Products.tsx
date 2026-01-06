import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  MoreVertical,
  ExternalLink,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  Package,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const products = [
  {
    id: "MLB123456789",
    title: "iPhone 15 Pro Max 256GB - Titânio Natural",
    status: "published",
    price: "R$ 8.999,00",
    stock: 15,
    views: 1234,
    sales: 8,
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=120&h=120&fit=crop",
    updatedAt: "há 2 horas",
  },
  {
    id: "MLB123456790",
    title: "MacBook Air M3 15\" 512GB - Meia-noite",
    status: "processing",
    price: "R$ 12.499,00",
    stock: 5,
    views: 0,
    sales: 0,
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=120&h=120&fit=crop",
    updatedAt: "há 10 minutos",
  },
  {
    id: "MLB123456791",
    title: "AirPods Pro 2ª Geração com Case MagSafe",
    status: "published",
    price: "R$ 1.899,00",
    stock: 32,
    views: 856,
    sales: 23,
    image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=120&h=120&fit=crop",
    updatedAt: "há 1 dia",
  },
  {
    id: "MLB123456792",
    title: "Apple Watch Series 9 GPS 45mm - Alumínio Meia-noite",
    status: "error",
    price: "R$ 4.299,00",
    stock: 8,
    views: 0,
    sales: 0,
    image: "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=120&h=120&fit=crop",
    updatedAt: "há 20 minutos",
  },
  {
    id: "MLB123456793",
    title: "iPad Pro 12.9\" M2 256GB WiFi - Cinza Espacial",
    status: "published",
    price: "R$ 10.999,00",
    stock: 3,
    views: 542,
    sales: 4,
    image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=120&h=120&fit=crop",
    updatedAt: "há 3 dias",
  },
  {
    id: "MLB123456794",
    title: "Fone Bluetooth Premium ANC | Cancelamento de Ruído",
    status: "pending",
    price: "R$ 459,90",
    stock: 50,
    views: 0,
    sales: 0,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=120&h=120&fit=crop",
    updatedAt: "agora",
  },
];

const statusMap = {
  published: { label: "Publicado", variant: "success" as const },
  processing: { label: "Processando", variant: "warning" as const },
  error: { label: "Erro", variant: "destructive" as const },
  pending: { label: "Pendente", variant: "pending" as const },
};

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="flex gap-2">
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
            <Button variant="outline">
              <RefreshCw className="h-4 w-4" />
              Sincronizar
            </Button>
          </div>
        </div>

        {/* Products Table */}
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
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-border/30 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={product.image}
                            alt={product.title}
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                          <div>
                            <p className="font-medium text-foreground line-clamp-1 max-w-xs">
                              {product.title}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {product.id} • {product.updatedAt}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={statusMap[product.status].variant}>
                          {statusMap[product.status].label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-foreground">{product.price}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span
                            className={
                              product.stock <= 5
                                ? "text-warning"
                                : "text-foreground"
                            }
                          >
                            {product.stock} un.
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {product.views}
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            {product.sales} vendas
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
                            <DropdownMenuItem>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Ver no ML
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Re-otimizar com IA
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
