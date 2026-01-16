import { Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MobileSidebar } from "./MobileSidebar";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b border-border/50 px-3 md:px-6 gap-2">
      {/* Mobile Menu Button */}
      <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
        <MobileSidebar />
        
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-xl font-semibold text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            variant="glass"
            placeholder="Buscar produtos..."
            className="w-64 pl-9"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative h-9 w-9 md:h-10 md:w-10">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            3
          </span>
        </Button>

        <div className="flex items-center gap-2 md:gap-3 rounded-lg glass px-2 md:px-3 py-1.5">
          <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-primary/20">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-foreground">Usuário</p>
            <Badge variant="success" className="mt-0.5 text-[10px]">
              Conectado
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
}
