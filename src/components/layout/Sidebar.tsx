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
  Warehouse,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { ScrollArea } from "@/components/ui/scroll-area";

const menuItems = [
  { icon: LayoutDashboard, labelKey: "nav.dashboard", path: "/" },
  { icon: BarChart3, labelKey: "nav.metrics", path: "/metrics" },
  { icon: TrendingUp, labelKey: "nav.analytics", path: "/analytics" },
  { icon: CircleDollarSign, labelKey: "nav.sales", path: "/sales" },
  { icon: Users, labelKey: "nav.buyers", path: "/buyers" },
  { icon: LineChart, labelKey: "nav.demand", path: "/demand" },
  { icon: History, labelKey: "nav.campaigns", path: "/campaigns" },
  { icon: Warehouse, labelKey: "nav.supplier", path: "/supplier" },
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
        "fixed left-0 top-0 z-40 h-screen border-r border-border/60 bg-sidebar transition-all duration-300 flex flex-col",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/60 shrink-0">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-glow">
            <Store className="h-5 w-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-foreground tracking-tight">ML Manager</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">by AI</span>
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 hover:bg-secondary"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-300",
              collapsed && "rotate-180"
            )}
          />
        </Button>
      </div>

      {/* Navigation with scroll */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30 shadow-inner-glow"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                )}
              >
                <item.icon 
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors", 
                    isActive ? "text-primary" : "group-hover:text-foreground"
                  )} 
                />
                {!collapsed && (
                  <span className="truncate">{t(item.labelKey)}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* AI Badge */}
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl bg-gradient-to-r from-primary/15 to-info/10 p-4 border border-primary/25 shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">IA Ativa</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Otimização automática de títulos e descrições
          </p>
        </div>
      )}

      {/* Logout */}
      <div className="border-t border-border/60 p-3 shrink-0">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-11",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </div>
    </aside>
  );
}