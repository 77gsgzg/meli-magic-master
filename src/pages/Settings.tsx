import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Store,
  Bell,
  Sparkles,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Link2Off,
} from "lucide-react";
import { useRequireAuth } from "@/hooks/useAuth";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { toast } from "sonner";

export default function Settings() {
  const { user, loading: authLoading } = useRequireAuth();
  const { connection, loading: mlLoading, getAuthUrl, handleCallback, checkConnection } = useMercadoLivre();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle ML OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (code && user) {
      const redirectUri = `${window.location.origin}/settings`;
      handleCallback(code, redirectUri).then((success) => {
        // Clear the code from URL
        setSearchParams({});
      });
    }
  }, [searchParams, user]);

  const handleConnectML = async () => {
    setIsConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/settings`;
      const authUrl = await getAuthUrl(redirectUri);
      if (authUrl) {
        window.location.href = authUrl;
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    try {
      // Token refresh happens automatically in the API calls
      await checkConnection();
      toast.success("Token renovado com sucesso!");
    } catch (error) {
      toast.error("Erro ao renovar token");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Configurações"
      subtitle="Gerencie sua conta e preferências"
    >
      <div className="max-w-3xl space-y-6">
        {/* Mercado Livre Connection */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Conexão Mercado Livre
            </CardTitle>
            <CardDescription>
              Gerencie a conexão OAuth com sua conta do Mercado Livre
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mlLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : connection.connected ? (
              <>
                <div className="flex items-center justify-between rounded-lg bg-success/10 border border-success/20 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-medium text-foreground">Conta conectada</p>
                      <p className="text-sm text-muted-foreground">
                        {connection.nickname} • Seller ID: {connection.seller_id}
                      </p>
                    </div>
                  </div>
                  <Badge variant={connection.is_expired ? "destructive" : "success"}>
                    {connection.is_expired ? "Expirado" : "Ativo"}
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Access Token</Label>
                    <div className="flex gap-2">
                      <Input
                        variant="glass"
                        value="••••••••••••••••••••"
                        readOnly
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="flex items-center gap-2 h-11 px-4 rounded-lg glass">
                      {connection.is_expired ? (
                        <>
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <span className="text-sm text-destructive">Token expirado</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="text-sm">Token válido</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleRefreshToken} disabled={isRefreshing}>
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Renovar Token
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Link2Off className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <p className="font-medium">Mercado Livre não conectado</p>
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta para começar a publicar produtos
                  </p>
                </div>
                <Button onClick={handleConnectML} disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Store className="h-4 w-4" />
                  )}
                  Conectar Mercado Livre
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Settings */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Inteligência Artificial
            </CardTitle>
            <CardDescription>
              Configure o comportamento da IA na otimização de produtos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Otimização automática de títulos</Label>
                <p className="text-sm text-muted-foreground">
                  Reescrever títulos para melhor SEO no Mercado Livre
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Enriquecimento de descrições</Label>
                <p className="text-sm text-muted-foreground">
                  Adicionar formatação e CTAs nas descrições
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Correção de atributos</Label>
                <p className="text-sm text-muted-foreground">
                  Ajustar automaticamente atributos obrigatórios
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Validação pré-publicação</Label>
                <p className="text-sm text-muted-foreground">
                  Verificar regras do ML antes de publicar
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notificações
            </CardTitle>
            <CardDescription>
              Configure como deseja receber alertas do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Publicações bem-sucedidas</Label>
                <p className="text-sm text-muted-foreground">
                  Notificar quando um produto for publicado
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Erros de publicação</Label>
                <p className="text-sm text-muted-foreground">
                  Alertar sobre falhas na publicação
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Renovação de token</Label>
                <p className="text-sm text-muted-foreground">
                  Avisar quando o token for renovado
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Segurança
            </CardTitle>
            <CardDescription>
              Informações sobre segurança e criptografia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-info/10 border border-info/20 p-4">
              <AlertCircle className="h-5 w-5 text-info mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">Tokens criptografados</p>
                <p className="text-sm text-muted-foreground">
                  Todos os tokens OAuth são armazenados de forma segura. 
                  As comunicações com a API do Mercado Livre são feitas exclusivamente via HTTPS.
                </p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Email: {user?.email}</p>
              <p>ID: {user?.id}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
