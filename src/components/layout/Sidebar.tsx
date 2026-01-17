import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Settings,
  History,
  LogOut,
  ChevronLeft,
  Sparkles,
  Store,
  Stethoscope,
  FileWarning,
  BarChart3,
  FileText,
  Webhook,
  TrendingUp,
  ClipboardList,
  ClipboardCheck,
  ShoppingBag,
  CircleDollarSign,
  Truck,
  Activity,
  Users,
  LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

const menuItems = [
  { icon: LayoutDashboard, labelKey: "nav.dashboard", path: "/" },
  { icon: BarChart3, labelKey: "nav.metrics", path: "/metrics" },
  { icon: TrendingUp, labelKey: "nav.analytics", path: "/analytics" },
  { icon: CircleDollarSign, labelKey: "nav.sales", path: "/sales" },
  { icon: Users, labelKey: "nav.buyers", path: "/buyers" },
  { icon: LineChart, labelKey: "nav.demand", path: "/demand" },
  { icon: ClipboardList, labelKey: "nav.importStats", path: "/import-statistics" },
  { icon: Store, labelKey: "nav.mercadoLivre", path: "/mercado-livre" },
  { icon: PlusCircle, labelKey: "nav.import", path: "/import" },
  { icon: Package, labelKey: "nav.products", path: "/products" },
  { icon: ShoppingBag, labelKey: "nav.orders", path: "/orders" },
  { icon: Truck, labelKey: "nav.shippingQueue", path: "/orders/queue" },
  { icon: Activity, labelKey: "nav.ordersMonitor", path: "/orders/monitor" },
  { icon: ClipboardCheck, labelKey: "nav.events", path: "/events" },
  { icon: History, labelKey: "nav.history", path: "/history" },
  { icon: FileText, labelKey: "nav.reports", path: "/reports" },
  { icon: Webhook, labelKey: "nav.webhooks", path: "/webhooks" },
  { icon: Stethoscope, labelKey: "nav.connectionDiag", path: "/mercado-livre/diagnostics" },
  { icon: FileWarning, labelKey: "nav.publicationDiag", path: "/publications/diagnostics" },
  { icon: Settings, labelKey: "nav.settings", path: "/settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen glass border-r border-border/50 transition-all duration-300",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border/50">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Store className="h-5 w-5 text-primary" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-foreground">ML Manager</span>
                <span className="text-xs text-muted-foreground">by AI</span>
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8"
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                collapsed && "rotate-180"
              )}
            />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                {!collapsed && <span>{t(item.labelKey)}</span>}
              </Link>
            );
          })}
        </nav>

        {/* AI Badge */}
        {!collapsed && (
          <div className="mx-3 mb-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 p-4 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">IA Ativa</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Otimização automática de títulos e descrições
            </p>
          </div>
        )}

        {/* Logout */}
        <div className="border-t border-border/50 p-3">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-muted-foreground hover:text-destructive",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}
