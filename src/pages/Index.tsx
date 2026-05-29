import { useSearchParams, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Dashboard from "./Dashboard";
import Landing from "./Landing";
import { useMercadoLivreOAuth } from "@/hooks/useMercadoLivreOAuth";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [searchParams] = useSearchParams();
  const { loading, initialized, user } = useAuth();

  // Hook que gerencia o callback OAuth automaticamente
  useMercadoLivreOAuth();

  const hasOAuthCode = searchParams.has("code");

  // Sessão ainda sendo restaurada
  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  // Tela dedicada do callback OAuth do Mercado Livre.
  if (hasOAuthCode) {
    if (!user) {
      // Sem sessão durante OAuth: manda para /auth preservando o code
      return <Navigate to="/auth" replace state={{ from: "/" }} />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Conectando ao Mercado Livre...</p>
        </div>
      </div>
    );
  }

  // Sem sessão → landing pública cinematográfica
  if (!user) {
    return <Landing />;
  }

  return <Dashboard />;
};

export default Index;

