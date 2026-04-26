import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

/**
 * Wrapper de rota: aguarda a sessão ser restaurada antes de decidir.
 * - Enquanto loading: mostra spinner (NÃO redireciona).
 * - Sem sessão: redireciona para /auth preservando o destino.
 * - requireAdmin: além de logado, exige role admin.
 */
export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, initialized } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const location = useLocation();

  const isLoading = !initialized || loading || (requireAdmin && roleLoading);

  useEffect(() => {
    if (isLoading) return;
    if (user && requireAdmin && !isAdmin) {
      toast.error("Acesso negado: área restrita a administradores.");
    }
  }, [isLoading, user, requireAdmin, isAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
