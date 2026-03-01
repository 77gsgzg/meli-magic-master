import { useState } from "react";
import { Search, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MobileSidebar } from "./MobileSidebar";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { WalletIndicator } from "./WalletIndicator";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex min-h-[56px] sm:min-h-[64px] items-center justify-between border-b border-border/60 bg-background/95 backdrop-blur-md px-4 sm:px-5 lg:px-6 gap-3">
      {/* Left section - Mobile menu & title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <MobileSidebar />
        
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate tracking-tight">
            {title}
          </h1>
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

        {/* Wallet Balance */}
        <WalletIndicator />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationsDropdown />

        {/* User profile */}
        <div className="flex items-center gap-2 sm:gap-3 rounded-lg glass px-2.5 sm:px-3 py-2 cursor-pointer hover:border-primary/40 transition-colors">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-tight">Usuário</p>
            <Badge variant="success" className="mt-0.5 text-[10px] px-1.5 py-0">
              Conectado
            </Badge>
          </div>
        </div>
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