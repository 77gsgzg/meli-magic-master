import { useEffect } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Dashboard from "./Dashboard";
import { useMercadoLivreOAuth } from "@/hooks/useMercadoLivreOAuth";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [searchParams] = useSearchParams();
  const { loading, initialized, user } = useAuth();

  // Hook que gerencia o callback OAuth automaticamente
  // Sempre captura o code na página raiz e processa
  useMercadoLivreOAuth();

  const hasOAuthCode = searchParams.has("code");

  // Mostrar loader enquanto a sessão é restaurada do storage.
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">
            {user ? "Conectando ao Mercado Livre..." : "Redirecionando para login..."}
          </p>
          {!user && (
            <p className="text-sm text-muted-foreground">
              Faça login para concluir a integração.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Sem sessão: vai para /auth preservando destino.
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: "/" }} />;
  }

  return <Dashboard />;
};

export default Index;
