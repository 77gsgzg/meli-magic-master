import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRequireAuth } from "@/hooks/useAuth";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  LogOut,
  ShoppingBag,
  Shield,
  Zap,
  Link2,
  AlertCircle,
} from "lucide-react";

export default function MercadoLivreConnect() {
  const { user, loading: authLoading } = useRequireAuth();
  const {
    connection,
    loading: mlLoading,
    getAuthUrl,
    handleCallback,
    disconnect,
    refreshToken,
    checkConnection,
  } = useMercadoLivre();
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [callbackProcessed, setCallbackProcessed] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (code && !callbackProcessed) {
      setCallbackProcessed(true);
      handleOAuthCallback(code);
    }
  }, [searchParams, callbackProcessed]);

  const handleOAuthCallback = async (code: string) => {
    setIsConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/mercado-livre`;
      const success = await handleCallback(code, redirectUri);
      if (success) {
        // Clean URL
        window.history.replaceState({}, document.title, "/mercado-livre");
        await checkConnection();
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/mercado-livre`;
      const authUrl = await getAuthUrl(redirectUri);
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        setIsConnecting(false);
      }
    } catch (error) {
      console.error("Error connecting:", error);
      toast.error("Erro ao iniciar conexão");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshToken();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (authLoading || mlLoading) {
    return (
      <DashboardLayout title="Mercado Livre" subtitle="Conecte sua conta">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Mercado Livre"
      subtitle="Conecte sua conta para publicar produtos automaticamente"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Connection Card */}
        <Card variant="glass" className="overflow-hidden">
          <div className="bg-gradient-to-r from-[#FFE600] to-[#FFF159] p-6">
            <div className="flex items-center gap-4">
              {/* ML Official Logo - Yellow hand icon */}
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg">
                <svg viewBox="0 0 40 40" className="h-10 w-10">
                  <circle cx="20" cy="20" r="18" fill="#FFE600"/>
                  <path
                    d="M20 8c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12S26.627 8 20 8zm0 22c-5.523 0-10-4.477-10-10s4.477-10 10-10 10 4.477 10 10-4.477 10-10 10z"
                    fill="#2D3277"
                  />
                  <path
                    d="M20 12c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm0 14c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z"
                    fill="#2D3277"
                  />
                  <circle cx="20" cy="20" r="3" fill="#2D3277"/>
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#2D3277]">Mercado Livre</h2>
                <p className="text-[#2D3277]/80">Integração Oficial via OAuth 2.0</p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {connection.connected ? (
              <div className="space-y-6">
                {/* Connected Status */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-success/10 border border-success/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                    <div>
                      <p className="font-medium text-success">Conta Conectada</p>
                      <p className="text-sm text-muted-foreground">
                        {connection.nickname || connection.seller_id}
                      </p>
                    </div>
                  </div>
                  <Badge variant={connection.is_expired ? "destructive" : "success"}>
                    {connection.is_expired ? "Token Expirado" : "Ativo"}
                  </Badge>
                </div>

                {/* Token Warning */}
                {connection.is_expired && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    <div>
                      <p className="text-sm font-medium text-warning">Token Expirado</p>
                      <p className="text-xs text-muted-foreground">
                        Clique em "Renovar Token" para continuar usando a API
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Renovar Token
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    Desconectar
                  </Button>
                </div>

                {/* Quick Access */}
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3">Comece a publicar:</p>
                  <Button className="w-full" onClick={() => navigate("/import")}>
                    <ShoppingBag className="h-4 w-4" />
                    Importar Produto
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Not Connected */}
                <div className="text-center py-4">
                  <h3 className="text-lg font-semibold mb-2">
                    Conecte sua conta do Mercado Livre
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Autorize o aplicativo para publicar produtos automaticamente na sua loja
                  </p>
                </div>

                {/* Connect Button */}
                <Button
                  className="w-full h-14 text-lg gap-3"
                  size="xl"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  style={{
                    background: "linear-gradient(135deg, #FFE600 0%, #FFF159 100%)",
                    color: "#2D3277",
                  }}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Redirecionando...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 40 40" className="h-6 w-6">
                        <circle cx="20" cy="20" r="18" fill="#2D3277"/>
                        <path
                          d="M20 12c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm0 14c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z"
                          fill="#FFE600"
                        />
                        <circle cx="20" cy="20" r="3" fill="#FFE600"/>
                      </svg>
                      Conectar com Mercado Livre
                    </>
                  )}
                </Button>

                {/* Security Info */}
                <div className="grid gap-3 pt-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Shield className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">100% Seguro</p>
                      <p className="text-xs text-muted-foreground">
                        Você faz login direto no Mercado Livre. Nunca armazenamos sua senha.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Link2 className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">OAuth 2.0 Oficial</p>
                      <p className="text-xs text-muted-foreground">
                        Utilizamos o protocolo oficial de autorização do Mercado Livre.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Zap className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Renovação Automática</p>
                      <p className="text-xs text-muted-foreground">
                        Tokens são renovados automaticamente para manter a conexão ativa.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Diagnóstico interno */}
            <div className="border border-dashed border-muted rounded-lg p-4 bg-muted/40">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Diagnóstico rápido (somente você vê isso)
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 mb-3 list-disc list-inside">
                <li>Se a página de login do Mercado Livre não abrir, tente uma guia anônima.</li>
                <li>Se após logar você voltar para a home sem explicação, saia da sua conta ML em outra aba e tente novamente.</li>
                <li>Problemas persistentes geralmente estão ligados a cookies/sessão do seu navegador.</li>
              </ul>
              <pre className="text-[10px] leading-snug font-mono bg-background/60 rounded-md p-2 overflow-x-auto">
                {JSON.stringify(connection, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Features when connected */}
        {connection.connected && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card variant="glass">
              <CardContent className="p-4 text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium mb-1">Importar Produtos</h4>
                <p className="text-xs text-muted-foreground">
                  Cole links e publique automaticamente
                </p>
              </CardContent>
            </Card>
            <Card variant="glass">
              <CardContent className="p-4 text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium mb-1">Otimização IA</h4>
                <p className="text-xs text-muted-foreground">
                  Títulos e descrições otimizados
                </p>
              </CardContent>
            </Card>
            <Card variant="glass">
              <CardContent className="p-4 text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium mb-1">API Oficial</h4>
                <p className="text-xs text-muted-foreground">
                  Publicação segura e confiável
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
