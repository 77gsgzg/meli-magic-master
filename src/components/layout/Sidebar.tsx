import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
  ImagePlus,
  Bot,
  Pickaxe,
  Rss,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsWalletAdmin } from "@/hooks/useIsWalletAdmin";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const menuItems = [
  { icon: LayoutDashboard, labelKey: "nav.dashboard", path: "/" },
  { icon: BarChart3, labelKey: "nav.metrics", path: "/metrics" },
  { icon: TrendingUp, labelKey: "nav.analytics", path: "/analytics" },
  { icon: CircleDollarSign, labelKey: "nav.sales", path: "/sales" },
  { icon: Users, labelKey: "nav.buyers", path: "/buyers" },
  { icon: LineChart, labelKey: "nav.demand", path: "/demand" },
  { icon: History, labelKey: "nav.campaigns", path: "/campaigns" },
  { icon: Warehouse, labelKey: "nav.supplier", path: "/supplier" },
  { icon: Wallet, labelKey: "nav.wallet", path: "/wallet" },
  { icon: ImagePlus, labelKey: "nav.aiImages", path: "/ai/images" },
  { icon: Bot, labelKey: "nav.aiTexts", path: "/ai/texts" },
  { icon: Pickaxe, labelKey: "nav.tiktokMiner", path: "/tiktok-miner" },
  { icon: Rss, labelKey: "nav.tiktokFeed", path: "/tiktok-feed" },
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
  { icon: ShieldCheck, labelKey: "Painel Admin", path: "/admin", adminOnly: true },
  { icon: Settings, labelKey: "nav.settings", path: "/settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isAdmin: isWalletAdmin } = useIsWalletAdmin();
  const { isAdmin } = useIsAdmin();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };


  const filteredMenuItems = menuItems.filter((item: any) => {
    if (item.adminOnly) return isAdmin;
    if (
      item.path === "/wallet" ||
      item.path === "/ai/images" ||
      item.path === "/ai/texts" ||
      item.path === "/tiktok-miner" ||
      item.path === "/tiktok-feed"
    ) {
      return isWalletAdmin;
    }
    return true;
  });

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border/60 bg-sidebar/95 backdrop-blur-xl transition-all duration-300 flex flex-col",
        "before:content-[''] before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-gradient-to-b before:from-transparent before:via-primary/30 before:to-transparent before:opacity-60",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/60 shrink-0 relative">
        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent border border-primary/40 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.55)]">
            <Store className="h-5 w-5 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_hsl(var(--primary))]" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-foreground tracking-tight leading-none">Ruxov</span>
              <span className="text-[10px] text-primary/80 uppercase tracking-[0.22em] mt-1 font-mono">
                Intelligence
              </span>
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 hover:bg-secondary hover:text-primary"
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
          />
        </Button>
      </div>

      {/* Navigation with scroll */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-0.5">

          {filteredMenuItems.map((item: any) => {
            const isActive = location.pathname === item.path;
            const label = item.labelKey.startsWith("nav.") ? t(item.labelKey) : item.labelKey;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                  isActive
                    ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-primary border border-primary/30 shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.15)]"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                )}
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    isActive ? "text-primary" : "group-hover:text-primary/80"
                  )}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Operational system status */}
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl cinematic-panel p-3 shrink-0 space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em]">
            <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success))] animate-pulse" />
            <span className="text-foreground/80">SYSTEM ONLINE</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em]">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] animate-pulse" />
            <span className="text-foreground/80">AI LINK ACTIVE</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em]">
            <span className="h-1.5 w-1.5 rounded-full bg-info shadow-[0_0_8px_hsl(var(--info))]" />
            <span className="text-foreground/80">MARKET SYNCED</span>
          </div>
        </div>
      )}


      {/* Logout */}
      <div className="border-t border-border/60 p-3 shrink-0">
        <Button
          variant="ghost"
          onClick={handleLogout}
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