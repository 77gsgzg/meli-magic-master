import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LucideIcon, Package, ShoppingCart, FileText, Users, BarChart3, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "compact" | "card";
  className?: string;
}

const defaultIcons: Record<string, LucideIcon> = {
  products: Package,
  orders: ShoppingCart,
  documents: FileText,
  users: Users,
  analytics: BarChart3,
  default: Inbox,
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  variant = "default",
  className,
}: EmptyStateProps) {
  const isCompact = variant === "compact";
  const isCard = variant === "card";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        isCompact ? "py-8 px-4" : "py-12 md:py-16 px-6",
        isCard && "glass rounded-xl border border-border/50",
        className
      )}
    >
      {/* Icon container with glow effect */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20",
          isCompact ? "h-12 w-12 mb-3" : "h-16 w-16 md:h-20 md:w-20 mb-4 md:mb-6"
        )}
      >
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
        <Icon
          className={cn(
            "relative text-primary",
            isCompact ? "h-5 w-5" : "h-7 w-7 md:h-9 md:w-9"
          )}
        />
      </div>

      {/* Title */}
      <h3
        className={cn(
          "font-semibold text-foreground",
          isCompact ? "text-base" : "text-lg md:text-xl"
        )}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            "text-muted-foreground max-w-sm",
            isCompact ? "text-sm mt-1" : "text-sm md:text-base mt-2"
          )}
        >
          {description}
        </p>
      )}

      {/* Action button */}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          variant="glow"
          size={isCompact ? "sm" : "default"}
          className={cn(isCompact ? "mt-3" : "mt-4 md:mt-6")}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

// Preset empty states for common use cases
export function EmptyProducts({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Package}
      title="Nenhum produto encontrado"
      description="Comece importando produtos de fornecedores ou cadastre manualmente."
      actionLabel={onAction ? "Importar Produto" : undefined}
      onAction={onAction}
    />
  );
}

export function EmptyOrders({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={ShoppingCart}
      title="Nenhum pedido encontrado"
      description="Quando você receber pedidos do Mercado Livre, eles aparecerão aqui."
      actionLabel={onAction ? "Sincronizar Pedidos" : undefined}
      onAction={onAction}
    />
  );
}

export function EmptyTableData({
  title = "Sem dados para exibir",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      icon={Inbox}
      title={title}
      description={description || "Nenhum registro foi encontrado com os filtros aplicados."}
      variant="compact"
    />
  );
}

export function EmptyAnalytics() {
  return (
    <EmptyState
      icon={BarChart3}
      title="Dados insuficientes"
      description="Aguarde mais vendas para gerar análises detalhadas."
      variant="compact"
    />
  );
}
