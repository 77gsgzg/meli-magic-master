import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentProducts } from "@/components/dashboard/RecentProducts";
import { QuickImport } from "@/components/dashboard/QuickImport";
import { BatchImport } from "@/components/dashboard/BatchImport";
import { ScheduledBatchImports } from "@/components/dashboard/ScheduledBatchImports";
import { ResumableImports } from "@/components/dashboard/ResumableImports";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { MercadoLivreStatusIndicators } from "@/components/dashboard/MercadoLivreStatusIndicators";
import { Package, TrendingUp, AlertCircle, CheckCircle, ShoppingCart } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion-wrapper";

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
      <div className="space-y-5 md:space-y-6">
        {/* Bento Stats Grid — asymmetric: hero card spans 2 cols on lg */}
        <StaggerContainer className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <StaggerItem className="lg:col-span-2 lg:row-span-1">
            <StatCard
              title="Total de Produtos"
              value={stats.total}
              icon={<Package className="h-5 w-5 md:h-6 md:w-6" />}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Publicados"
              value={stats.published}
              trend="up"
              icon={<CheckCircle className="h-5 w-5 md:h-6 md:w-6" />}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Taxa de Sucesso"
              value={`${successRate}%`}
              trend={successRate >= 80 ? "up" : "down"}
              icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6" />}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Vendas Totais"
              value={totalSales}
              trend="up"
              icon={<ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Erros"
              value={stats.errors}
              trend={stats.errors > 0 ? "down" : "up"}
              icon={<AlertCircle className="h-5 w-5 md:h-6 md:w-6" />}
            />
          </StaggerItem>
        </StaggerContainer>

        {/* Main Content */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <ResumableImports />
            <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
              <QuickImport />
              <BatchImport />
            </div>
            <ScheduledBatchImports />
            <RecentProducts products={products.slice(0, 5)} />
          </div>
          <div className="space-y-4">
            <ActivityFeed />
            <MercadoLivreStatusIndicators />
          </div>
        </div>
      </div>

            </div>
            <ScheduledBatchImports />
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

