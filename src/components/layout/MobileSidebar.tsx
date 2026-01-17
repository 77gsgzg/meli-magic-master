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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10"
          aria-label="Abrir menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 glass border-r border-border/50">
        <SheetHeader className="px-4 py-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-foreground">ML Manager</span>
              <span className="text-xs text-muted-foreground">by AI</span>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto max-h-[calc(100vh-180px)]">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {/* AI Badge */}
        <div className="mx-3 mb-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 p-4 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">IA Ativa</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Otimização automática de títulos e descrições
          </p>
        </div>

        {/* Logout */}
        <div className="border-t border-border/50 p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
