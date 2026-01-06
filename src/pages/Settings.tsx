import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Store,
  Key,
  Bell,
  Sparkles,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export default function Settings() {
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
            <div className="flex items-center justify-between rounded-lg bg-success/10 border border-success/20 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <p className="font-medium text-foreground">Conta conectada</p>
                  <p className="text-sm text-muted-foreground">Seller ID: 123456789</p>
                </div>
              </div>
              <Badge variant="success">Ativo</Badge>
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
                <Label className="text-muted-foreground">Expira em</Label>
                <div className="flex items-center gap-2 h-11 px-4 rounded-lg glass">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <span className="text-sm">5 horas 23 minutos</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline">
                <RefreshCw className="h-4 w-4" />
                Renovar Token
              </Button>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                Desconectar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Chaves de API
            </CardTitle>
            <CardDescription>
              Configure suas credenciais do aplicativo Mercado Livre
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Client ID</Label>
              <Input variant="glass" placeholder="Seu Client ID" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Client Secret</Label>
              <Input variant="glass" type="password" placeholder="Seu Client Secret" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Redirect URI</Label>
              <Input
                variant="glass"
                value="https://seusite.com/callback"
                readOnly
                className="text-muted-foreground"
              />
            </div>
            <Button>Salvar Credenciais</Button>
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
                  Adicionar emojis, formatação e CTAs nas descrições
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
                  Todos os tokens OAuth são armazenados com criptografia AES-256. 
                  As comunicações com a API do Mercado Livre são feitas exclusivamente via HTTPS.
                </p>
              </div>
            </div>

            <Button variant="outline">
              <ExternalLink className="h-4 w-4" />
              Ver logs de segurança
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
