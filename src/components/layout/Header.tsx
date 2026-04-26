import { useState, useEffect } from "react";
import { Search, User, X, Copy, LogOut, ShieldCheck, UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileSidebar } from "./MobileSidebar";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { AuthStatusBadge } from "@/components/auth/AuthStatusBadge";
import { WalletIndicator } from "./WalletIndicator";
import { useIsWalletAdmin } from "@/hooks/useIsWalletAdmin";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { maskEmail } from "@/lib/privacy";
import { toast } from "sonner";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const navigate = useNavigate();
  const { isAdmin: isWalletAdmin } = useIsWalletAdmin();
  const { isAdmin } = useIsAdmin();
  const { user, signOut } = useAuth();

  const userId = user?.id ?? "";
  const shortId = userId ? `${userId.slice(0, 8)}…${userId.slice(-4)}` : "—";
  const maskedEmail = user?.email ? maskEmail(user.email) : "—";

  // Reatividade total: se o usuário sair (em outra aba, expiração, etc.),
  // fecha automaticamente o dropdown do perfil.
  useEffect(() => {
    if (!user && openProfile) {
      setOpenProfile(false);
    }
  }, [user, openProfile]);

  async function copyId() {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      toast.success("ID copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  async function handleLogout() {
    setOpenProfile(false);
    await signOut();
    navigate("/auth", { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-[56px] sm:min-h-[64px] items-center justify-between border-b border-border/60 bg-background/95 backdrop-blur-md px-4 sm:px-5 lg:px-6 gap-3">
      {/* Left section - Mobile menu & title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <MobileSidebar />
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate tracking-tight">
              {title}
            </h1>
            {/* Indicador temporário de estado de sessão (debug) */}
            <AuthStatusBadge />
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate hidden xs:block mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right section - Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Mobile search toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden h-10 w-10 touch-target"
          onClick={() => setSearchOpen(!searchOpen)}
        >
          {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </Button>

        {/* Desktop search */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            variant="glass"
            placeholder="Buscar produtos..."
            className="w-56 xl:w-72 pl-10 h-10"
          />
        </div>

        {/* Wallet Balance - admin only */}
        {isWalletAdmin && <WalletIndicator />}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationsDropdown />

        {/* User profile dropdown — só renderiza se houver sessão ativa.
            Garante reatividade 100% ao estado do auth. */}
        {user ? (
          <DropdownMenu open={openProfile} onOpenChange={setOpenProfile}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={() => setOpenProfile((prev) => !prev)}
                className="flex items-center gap-2 sm:gap-3 rounded-lg glass px-2.5 sm:px-3 py-2 cursor-pointer hover:border-primary/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Abrir menu de perfil"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {isAdmin ? "Admin" : "Usuário"}
                  </p>
                  <Badge variant="success" className="mt-0.5 text-[10px] px-1.5 py-0">
                    Conectado
                  </Badge>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {maskedEmail}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {isAdmin ? "Administrador" : "Usuário"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyId}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/30 px-2 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors"
                  title="Copiar ID completo"
                >
                  <span className="font-mono text-muted-foreground truncate">{shortId}</span>
                  <Copy className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setOpenProfile(false);
                  navigate("/settings");
                }}
                className="cursor-pointer"
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Ver Perfil
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem
                  onClick={() => {
                    setOpenProfile(false);
                    navigate("/admin");
                  }}
                  className="cursor-pointer text-primary focus:text-primary"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Painel Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => navigate("/auth")}
          >
            Entrar
          </Button>
        )}
      </div>

      {/* Mobile search bar - slides down when open */}
      {searchOpen && (
        <div className="absolute left-0 right-0 top-full p-3 bg-background/95 backdrop-blur-md border-b border-border/60 lg:hidden animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              variant="glass"
              placeholder="Buscar produtos..."
              className="w-full pl-10 h-11"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
