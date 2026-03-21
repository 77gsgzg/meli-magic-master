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
  Sparkles,
  Store,
  Stethoscope,
  FileWarning,
  BarChart3,
  Megaphone,
  FileText,
  Webhook,
  TrendingUp,
  ClipboardList,
  ClipboardCheck,
  Menu,
  ShoppingBag,
  Truck,
  Activity,
  CircleDollarSign,
  Users,
  LineChart,
  Warehouse,
  Wallet,
  ImagePlus,
  Bot,
  Pickaxe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsWalletAdmin } from "@/hooks/useIsWalletAdmin";

const menuItems = [
  { icon: LayoutDashboard, labelKey: "nav.dashboard", path: "/" },
  { icon: BarChart3, labelKey: "nav.metrics", path: "/metrics" },
  { icon: TrendingUp, labelKey: "nav.analytics", path: "/analytics" },
  { icon: CircleDollarSign, labelKey: "nav.sales", path: "/sales" },
  { icon: Users, labelKey: "nav.buyers", path: "/buyers" },
  { icon: LineChart, labelKey: "nav.demand", path: "/demand" },
  { icon: Warehouse, labelKey: "nav.supplier", path: "/supplier" },
  { icon: Wallet, labelKey: "nav.wallet", path: "/wallet" },
  { icon: ImagePlus, labelKey: "nav.aiImages", path: "/ai/images" },
  { icon: Bot, labelKey: "nav.aiTexts", path: "/ai/texts" },
  { icon: Pickaxe, labelKey: "nav.tiktokMiner", path: "/tiktok-miner" },
  { icon: ClipboardList, labelKey: "nav.importStats", path: "/import-statistics" },
  { icon: Store, labelKey: "nav.mercadoLivre", path: "/mercado-livre" },
  { icon: PlusCircle, labelKey: "nav.import", path: "/import" },
  { icon: Package, labelKey: "nav.products", path: "/products" },
  { icon: ShoppingBag, labelKey: "nav.orders", path: "/orders" },
  { icon: Truck, labelKey: "nav.shippingQueue", path: "/orders/queue" },
  { icon: Activity, labelKey: "nav.ordersMonitor", path: "/orders/monitor" },
  { icon: ClipboardCheck, labelKey: "nav.events", path: "/events" },
  { icon: History, labelKey: "nav.history", path: "/history" },
  { icon: Megaphone, labelKey: "nav.campaigns", path: "/campaigns" },
  { icon: FileText, labelKey: "nav.reports", path: "/reports" },
  { icon: Webhook, labelKey: "nav.webhooks", path: "/webhooks" },
  { icon: Stethoscope, labelKey: "nav.connectionDiag", path: "/mercado-livre/diagnostics" },
  { icon: FileWarning, labelKey: "nav.publicationDiag", path: "/publications/diagnostics" },
  { icon: Settings, labelKey: "nav.settings", path: "/settings" },
];

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();
  const { isAdmin: isWalletAdmin } = useIsWalletAdmin();

  const filteredMenuItems = menuItems.filter(
    (item) => {
      if (item.path === "/wallet" || item.path === "/ai/images" || item.path === "/ai/texts" || item.path === "/tiktok-miner") {
        return isWalletAdmin;
      }
      return true;
    }
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-11 w-11 touch-target"
          aria-label="Abrir menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="left" 
        className="w-[300px] sm:w-[320px] p-0 bg-sidebar border-r border-border/60"
      >
        <SheetHeader className="px-4 py-4 border-b border-border/60">
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-glow">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-foreground text-lg tracking-tight">ML Manager</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">by AI</span>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Navigation with scroll */}
        <ScrollArea className="flex-1 h-[calc(100vh-220px)]">
          <nav className="space-y-1 p-3">
            {filteredMenuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3.5 text-sm font-medium transition-all duration-200 touch-target",
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary/80 border border-transparent"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* AI Badge */}
        <div className="mx-3 mb-3 rounded-xl bg-gradient-to-r from-primary/15 to-info/10 p-4 border border-primary/25">
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

        {/* Logout */}
        <div className="border-t border-border/60 p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-12 touch-target"
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}