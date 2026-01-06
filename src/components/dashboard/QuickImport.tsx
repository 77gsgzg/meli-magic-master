import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link2, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function QuickImport() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleImport = async () => {
    if (!url) return;
    setIsLoading(true);
    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);
    navigate("/import", { state: { url } });
  };

  return (
    <Card variant="glass" className="animate-fade-in overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <CardHeader className="relative">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Importação Rápida</CardTitle>
            <CardDescription>Cole o link do produto para importar</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            variant="glass"
            placeholder="https://www.mercadolivre.com.br/produto..."
            className="pl-10 pr-4 h-12"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          size="lg"
          onClick={handleImport}
          disabled={!url || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              Importar com IA
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          A IA irá extrair, otimizar e preparar o produto automaticamente
        </p>
      </CardContent>
    </Card>
  );
}
