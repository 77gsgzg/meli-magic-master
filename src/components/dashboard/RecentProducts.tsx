import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, MoreVertical } from "lucide-react";

const recentProducts = [
  {
    id: 1,
    title: "iPhone 15 Pro Max 256GB - Titânio Natural",
    status: "published",
    price: "R$ 8.999,00",
    views: 1234,
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=80&h=80&fit=crop",
  },
  {
    id: 2,
    title: "MacBook Air M3 15\" 512GB - Meia-noite",
    status: "processing",
    price: "R$ 12.499,00",
    views: 0,
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=80&h=80&fit=crop",
  },
  {
    id: 3,
    title: "AirPods Pro 2ª Geração com Case MagSafe",
    status: "published",
    price: "R$ 1.899,00",
    views: 856,
    image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=80&h=80&fit=crop",
  },
  {
    id: 4,
    title: "Apple Watch Series 9 GPS 45mm - Alumínio",
    status: "error",
    price: "R$ 4.299,00",
    views: 0,
    image: "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=80&h=80&fit=crop",
  },
];

const statusMap = {
  published: { label: "Publicado", variant: "success" as const },
  processing: { label: "Processando", variant: "warning" as const },
  error: { label: "Erro", variant: "destructive" as const },
  pending: { label: "Pendente", variant: "pending" as const },
};

export function RecentProducts() {
  return (
    <Card variant="glass" className="animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Produtos Recentes</CardTitle>
        <Button variant="ghost" size="sm">
          Ver todos
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentProducts.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-secondary/50"
          >
            <img
              src={product.image}
              alt={product.title}
              className="h-14 w-14 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{product.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={statusMap[product.status].variant}>
                  {statusMap[product.status].label}
                </Badge>
                <span className="text-sm text-muted-foreground">{product.price}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {product.views > 0 && (
                <span className="text-sm text-muted-foreground">{product.views} views</span>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
