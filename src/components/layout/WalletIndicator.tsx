import { useWallet } from "@/hooks/useWallet";
import { Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletIndicator() {
  const { balance, loading } = useWallet();

  return (
    <Link
      to="/wallet"
      className="flex items-center gap-2 rounded-lg glass px-2.5 sm:px-3 py-2 cursor-pointer hover:border-primary/40 transition-colors"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-success/30 to-success/10 border border-success/30">
        <Wallet className="h-3.5 w-3.5 text-success" />
      </div>
      <div className="hidden sm:block">
        {loading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <p className="text-sm font-semibold text-foreground leading-tight">
            R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>
    </Link>
  );
}
