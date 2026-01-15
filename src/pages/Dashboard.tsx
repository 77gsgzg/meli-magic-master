import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentProducts } from "@/components/dashboard/RecentProducts";
import { QuickImport } from "@/components/dashboard/QuickImport";
import { BatchImport } from "@/components/dashboard/BatchImport";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { MercadoLivreStatusIndicators } from "@/components/dashboard/MercadoLivreStatusIndicators";
import { Package, TrendingUp, AlertCircle, CheckCircle, ShoppingCart } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { products, loading, getProductStats } = useProducts();
  const stats = getProductStats();

  // Calculate success rate
  const successRate = stats.total > 0 
    ? Math.round((stats.published / stats.total) * 100) 
    : 0;

  // Calculate total sales
  const totalSales = products.reduce((acc, p) => acc + (p.sales || 0), 0);

  if (loading) {
    return (
      <DashboardLayout
        title="Dashboard"
        subtitle="Gerencie seus produtos do Mercado Livre"
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Gerencie seus produtos do Mercado Livre"
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total de Produtos"
            value={stats.total}
            icon={<Package className="h-6 w-6" />}
          />
          <StatCard
            title="Publicados"
            value={stats.published}
            trend="up"
            icon={<CheckCircle className="h-6 w-6" />}
          />
          <StatCard
            title="Taxa de Sucesso"
            value={`${successRate}%`}
            trend={successRate >= 80 ? "up" : "down"}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Vendas Totais"
            value={totalSales}
            trend="up"
            icon={<ShoppingCart className="h-6 w-6" />}
          />
          <StatCard
            title="Erros"
            value={stats.errors}
            trend={stats.errors > 0 ? "down" : "up"}
            icon={<AlertCircle className="h-6 w-6" />}
          />
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <QuickImport />
              <BatchImport />
            </div>
            <RecentProducts products={products.slice(0, 5)} />
          </div>
          <div className="space-y-4">
            <ActivityFeed />
            {/* Indicadores em tempo real da integração Mercado Livre */}
            <MercadoLivreStatusIndicators />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

