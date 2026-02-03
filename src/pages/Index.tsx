import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import { useMercadoLivreOAuth } from "@/hooks/useMercadoLivreOAuth";

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Hook que gerencia o callback OAuth automaticamente
  // Sempre captura o code na página raiz e processa
  useMercadoLivreOAuth();

  // Se houver code na URL, o hook acima vai processar automaticamente
  // Mostramos uma mensagem de loading enquanto processa
  const hasOAuthCode = searchParams.has('code');

  if (hasOAuthCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Conectando ao Mercado Livre...</p>
        </div>
      </div>
    );
  }

  return <Dashboard />;
};

export default Index;
