import { useAuth } from "@/hooks/useAuth";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

/**
 * Indicador visual temporário do estado de sessão.
 * Útil durante debug do fluxo de autenticação.
 */
export function AuthStatusBadge() {
  const { user, loading, initialized } = useAuth();

  const baseClass =
    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase";

  if (!initialized || loading) {
    return (
      <span className={`${baseClass} border-border bg-muted/50 text-muted-foreground`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Verificando
      </span>
    );
  }

  if (user) {
    return (
      <span
        className={`${baseClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-500`}
        title={user.email ?? user.id}
      >
        <ShieldCheck className="h-3 w-3" />
        Logado
      </span>
    );
  }

  return (
    <span className={`${baseClass} border-destructive/40 bg-destructive/10 text-destructive`}>
      <ShieldAlert className="h-3 w-3" />
      Não logado
    </span>
  );
}
