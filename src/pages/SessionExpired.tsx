import { useNavigate, useLocation, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn, ShieldAlert, Home } from "lucide-react";
import { getRedirectFrom } from "@/lib/authRedirect";

/**
 * Tela exibida quando a sessão expira. Preserva o destino original
 * para que o usuário volte exatamente para onde estava após relogar.
 */
export default function SessionExpired() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = getRedirectFrom(location.state, "/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card variant="glass" className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Sessão expirada</CardTitle>
          <CardDescription>
            Por segurança, sua sessão foi encerrada por inatividade ou foi finalizada em outro dispositivo.
            Faça login novamente para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Destino salvo:</span>{" "}
              <code className="font-mono">{from}</code>
            </p>
            <p className="mt-1">Você voltará para essa tela após o login.</p>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={() =>
              navigate("/auth", {
                replace: true,
                state: { from, reason: "session_expired" },
              })
            }
          >
            <LogIn className="h-5 w-5" />
            Fazer login novamente
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">
              <Home className="h-4 w-4" />
              Ir para o início
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
