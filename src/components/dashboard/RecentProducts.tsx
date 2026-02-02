import { AnimatedCard, AnimatedCardContent, AnimatedCardHeader, AnimatedCardTitle } from "@/components/ui/animated-card";
import { Badge } from "@/components/ui/badge";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Button } from "@/components/ui/button";
import { ExternalLink, MoreVertical, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { motion } from "framer-motion";

type Product = Tables<'products'>;

interface RecentProductsProps {
  products: Product[];
}

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "pending" | "default" }> = {
  published: { label: "Publicado", variant: "success" },
  pending: { label: "Pendente", variant: "pending" },
  draft: { label: "Rascunho", variant: "default" },
  error: { label: "Erro", variant: "destructive" },
  paused: { label: "Pausado", variant: "warning" },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

const containerVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export function RecentProducts({ products }: RecentProductsProps) {
  const navigate = useNavigate();

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

  if (products.length === 0) {
    return (
      <AnimatedCard variant="glass" enableHover enableGlow>
        <AnimatedCardHeader className="flex flex-row items-center justify-between">
          <AnimatedCardTitle className="text-lg">Produtos Recentes</AnimatedCardTitle>
        </AnimatedCardHeader>
        <AnimatedCardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum produto ainda</p>
            <AnimatedButton variant="outline" className="mt-4" onClick={() => navigate('/import')}>
              Importar Primeiro Produto
            </AnimatedButton>
          </div>
        </AnimatedCardContent>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard variant="glass" enableHover enableGlow>
      <AnimatedCardHeader className="flex flex-row items-center justify-between">
        <AnimatedCardTitle className="text-lg">Produtos Recentes</AnimatedCardTitle>
        <AnimatedButton variant="ghost" size="sm" onClick={() => navigate('/products')}>
          Ver todos
        </AnimatedButton>
      </AnimatedCardHeader>
      <AnimatedCardContent>
        <motion.div 
          className="space-y-4"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {products.map((product) => {
            const imageUrl = getFirstImage(product.images);
            const status = statusMap[product.status || 'draft'] || statusMap.draft;
            
            return (
              <motion.div
                key={product.id}
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.02, 
                  y: -2,
                  transition: { type: "spring", stiffness: 400, damping: 25 }
                }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-secondary/50 cursor-pointer"
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.title}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{product.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={status.variant}>
                      {status.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatPrice(product.price, product.currency)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(product.views || 0) > 0 && (
                    <span className="text-sm text-muted-foreground">{product.views} views</span>
                  )}
                  {product.ml_permalink && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => window.open(product.ml_permalink!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatedCardContent>
    </AnimatedCard>
  );
}
