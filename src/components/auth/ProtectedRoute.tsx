import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import { logAuthEvent } from "@/lib/authTelemetry";
import { buildFullPath } from "@/lib/authRedirect";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

/**
 * Wrapper de rota: aguarda a sessão ser restaurada antes de decidir.
 * - Enquanto loading: mostra spinner (NÃO redireciona).
 * - Sem sessão: redireciona para /auth preservando o destino completo (path+search+hash).
 * - requireAdmin: além de logado, exige role admin.
 */
export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, initialized } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const location = useLocation();

  const isLoading = !initialized || loading || (requireAdmin && roleLoading);
  const fullPath = buildFullPath(location);

  useEffect(() => {
    if (isLoading) {
      logAuthEvent("redirect_blocked_loading", {
        from: fullPath,
        loading,
        initialized,
        roleLoading,
        requireAdmin,
      });
      return;
    }
    if (user && requireAdmin && !isAdmin) {
      logAuthEvent("redirect_admin_denied", { from: fullPath, userId: user.id });
      toast.error("Acesso negado: área restrita a administradores.");
    }
  }, [isLoading, user, requireAdmin, isAdmin, fullPath, loading, initialized, roleLoading]);

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
    logAuthEvent("redirect_to_auth", {
      source: "ProtectedRoute",
      from: fullPath,
      loading,
      initialized,
      hasUser: false,
    });
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: fullPath, reason: "unauthenticated" }}
      />
    );
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
