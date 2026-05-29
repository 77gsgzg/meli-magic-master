import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, MoreVertical, Package, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Product = Tables<'products'>;

interface RecentProductsProps {
  products: Product[];
}

const statusMap: Record<string, { label: string; tone: string; dot: string }> = {
  published: { label: "PUBLISHED", tone: "text-success",          dot: "bg-success" },
  pending:   { label: "PENDING",   tone: "text-warning",          dot: "bg-warning" },
  draft:     { label: "DRAFT",     tone: "text-muted-foreground", dot: "bg-muted-foreground" },
  error:     { label: "ERROR",     tone: "text-destructive",      dot: "bg-destructive" },
  paused:    { label: "PAUSED",    tone: "text-warning",          dot: "bg-warning/70" },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 28 },
  },
};

const containerVariants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
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
      currency: currency || 'BRL',
    }).format(price);
  };

  return (
    <div className="panel-premium overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-background/40">
        <div className="flex items-center gap-2.5">
          <Package className="h-3.5 w-3.5 text-primary" />
          <span className="mono-label">recent_products</span>
          <span className="mono-label text-muted-foreground/60">· {products.length.toString().padStart(2, "0")}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/products')}
          className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
        >
          view_all <ArrowUpRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
          <div className="h-12 w-12 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-center mb-4">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mono-label mb-1">empty_state</p>
          <p className="text-sm text-muted-foreground mb-4">Nenhum produto ainda</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/import')}>
            Importar primeiro produto
          </Button>
        </div>
      ) : (
        <>
          {/* Column headers (desktop) */}
          <div className="hidden md:grid grid-cols-[3rem_1fr_8rem_6rem_4rem] gap-3 px-4 py-2 border-b border-border/30 bg-background/20">
            <span className="mono-label" />
            <span className="mono-label">product</span>
            <span className="mono-label">status</span>
            <span className="mono-label text-right">price</span>
            <span className="mono-label text-right">views</span>
          </div>

          <motion.ul
            className="divide-y divide-border/30"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {products.map((product) => {
              const imageUrl = getFirstImage(product.images);
              const status = statusMap[product.status || 'draft'] || statusMap.draft;

              return (
                <motion.li
                  key={product.id}
                  variants={itemVariants}
                  whileHover={{ x: 2 }}
                  className="group relative px-4 py-3 hover:bg-primary/[0.04] transition-colors cursor-pointer"
                >
                  {/* Hover accent bar */}
                  <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary/0 group-hover:bg-primary transition-colors" />

                  {/* Desktop layout */}
                  <div className="hidden md:grid grid-cols-[3rem_1fr_8rem_6rem_4rem] gap-3 items-center">
                    {imageUrl ? (
                      <img src={imageUrl} alt={product.title} className="h-10 w-10 rounded-md object-cover border border-border/60" />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted/40 border border-border/60 flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-sm text-foreground/90 truncate font-medium">{product.title}</p>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
                      <span className={cn("mono-label", status.tone)}>{status.label}</span>
                    </div>
                    <span className="text-xs text-foreground/80 num-display text-right tabular-nums">
                      {formatPrice(product.price, product.currency)}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-xs text-muted-foreground num-display tabular-nums">
                        {(product.views || 0).toLocaleString('pt-BR')}
                      </span>
                      {product.ml_permalink && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); window.open(product.ml_permalink!, '_blank'); }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Mobile layout */}
                  <div className="md:hidden flex items-center gap-3">
                    {imageUrl ? (
                      <img src={imageUrl} alt={product.title} className="h-12 w-12 rounded-md object-cover border border-border/60 shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-muted/40 border border-border/60 flex items-center justify-center shrink-0">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/90 truncate font-medium mb-1">{product.title}</p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                          <span className={cn("mono-label", status.tone)}>{status.label}</span>
                        </div>
                        <span className="text-xs text-foreground/80 num-display tabular-nums">
                          {formatPrice(product.price, product.currency)}
                        </span>
                      </div>
                    </div>
                    {product.ml_permalink && (
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                        onClick={(e) => { e.stopPropagation(); window.open(product.ml_permalink!, '_blank'); }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        </>
      )}
    </div>
  );
}
