import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentProducts } from "@/components/dashboard/RecentProducts";
import { QuickImport } from "@/components/dashboard/QuickImport";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Package, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";

export default function Dashboard() {
  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Gerencie seus produtos do Mercado Livre"
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Produtos"
            value={127}
            change={12}
            trend="up"
            icon={<Package className="h-6 w-6" />}
          />
          <StatCard
            title="Publicados"
            value={98}
            change={8}
            trend="up"
            icon={<CheckCircle className="h-6 w-6" />}
          />
          <StatCard
            title="Taxa de Sucesso"
            value="94%"
            change={3}
            trend="up"
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Erros Pendentes"
            value={5}
            change={-2}
            trend="down"
            icon={<AlertCircle className="h-6 w-6" />}
          />
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <QuickImport />
            <RecentProducts />
          </div>
          <div>
            <ActivityFeed />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
