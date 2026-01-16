import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeIndicator } from "@/components/ui/SwipeIndicator";
import {
  Store,
  Bell,
  Sparkles,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2Off,
  Palette,
  Sun,
  Moon,
  Monitor,
  Languages,
  User,
  Database,
} from "lucide-react";
import { useRequireAuth } from "@/hooks/useAuth";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { useTheme } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeTabs } from "@/hooks/useSwipeTabs";
import { useLanguage, Language } from "@/hooks/useLanguage";
import { UserPreferencesSection } from "@/components/settings/UserPreferencesSection";
import { BackupRestoreSection } from "@/components/settings/BackupRestoreSection";

export default function Settings() {
  const { user, loading: authLoading } = useRequireAuth();
  const { connection, loading: mlLoading, getAuthUrl, handleCallback, disconnect, refreshToken } = useMercadoLivre();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, languageNames, t } = useLanguage();
  const isMobile = useIsMobile();

  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [activeTab, setActiveTab] = useState("account");

  // Handle ML OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (code && user) {
      const redirectUri = `${window.location.origin}/settings`;
      handleCallback(code, redirectUri).then((success) => {
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
      await refreshToken();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar sua conta do Mercado Livre?')) {
      return;
    }
    
    setIsDisconnecting(true);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const swipeHandlers = useSwipeTabs({
    tabs: ["account", "preferences", "appearance", "ai", "backup"] as const,
    value: activeTab as "account" | "preferences" | "appearance" | "ai" | "backup",
    onValueChange: (v) => setActiveTab(v),
    enabled: isMobile,
  });

  return (
    <DashboardLayout
      title="Configurações"
      subtitle="Gerencie sua conta e preferências"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-4xl" {...swipeHandlers}>
        <TabsList className="mb-6 flex flex-wrap w-full h-auto gap-1 p-1">
          <TabsTrigger value="account" className="gap-1 md:gap-2 text-xs md:text-sm flex-1 sm:flex-none">
            <User className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Conta</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1 md:gap-2 text-xs md:text-sm flex-1 sm:flex-none">
            <Bell className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Preferências</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1 md:gap-2 text-xs md:text-sm flex-1 sm:flex-none">
            <Palette className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Aparência</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1 md:gap-2 text-xs md:text-sm flex-1 sm:flex-none">
            <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">IA</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-1 md:gap-2 text-xs md:text-sm flex-1 sm:flex-none">
            <Database className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Backup</span>
          </TabsTrigger>
        </TabsList>
        {isMobile && (
          <SwipeIndicator
            currentIndex={["account", "preferences", "appearance", "ai", "backup"].indexOf(activeTab)}
            totalTabs={5}
            tabLabels={["Conta", "Pref.", "Apar.", "IA", "Backup"]}
            className="mb-4"
          />
        )}

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
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

                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleRefreshToken} disabled={isRefreshing} className="flex-1 sm:flex-none">
                      {isRefreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2">Renovar Token</span>
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDisconnect} 
                      disabled={isDisconnecting}
                      className="flex-1 sm:flex-none"
                    >
                      {isDisconnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2Off className="h-4 w-4" />
                      )}
                      <span className="ml-2">Desconectar</span>
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
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          {user && <UserPreferencesSection userId={user.id} />}
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Tema
              </CardTitle>
              <CardDescription>
                Personalize a aparência do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base">Modo de exibição</Label>
                <RadioGroup
                  value={theme}
                  onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}
                  className="grid grid-cols-3 gap-2 md:gap-4"
                >
                  <Label
                    htmlFor="theme-light"
                    className={`flex flex-col items-center justify-center rounded-lg border-2 p-3 md:p-4 cursor-pointer transition-all ${
                      theme === "light"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="light" id="theme-light" className="sr-only" />
                    <Sun className="h-5 w-5 md:h-6 md:w-6 mb-1 md:mb-2" />
                    <span className="text-xs md:text-sm font-medium">Claro</span>
                  </Label>
                  <Label
                    htmlFor="theme-dark"
                    className={`flex flex-col items-center justify-center rounded-lg border-2 p-3 md:p-4 cursor-pointer transition-all ${
                      theme === "dark"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
                    <Moon className="h-5 w-5 md:h-6 md:w-6 mb-1 md:mb-2" />
                    <span className="text-xs md:text-sm font-medium">Escuro</span>
                  </Label>
                  <Label
                    htmlFor="theme-system"
                    className={`flex flex-col items-center justify-center rounded-lg border-2 p-3 md:p-4 cursor-pointer transition-all ${
                      theme === "system"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="system" id="theme-system" className="sr-only" />
                    <Monitor className="h-5 w-5 md:h-6 md:w-6 mb-1 md:mb-2" />
                    <span className="text-xs md:text-sm font-medium">Sistema</span>
                  </Label>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  {t("settings.theme.desc")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                {t("settings.language")}
              </CardTitle>
              <CardDescription>
                Selecione o idioma da interface
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={language}
                onValueChange={(value) => setLanguage(value as Language)}
                className="grid grid-cols-3 gap-4"
              >
                {(["pt-BR", "es", "en"] as Language[]).map((lang) => (
                  <Label
                    key={lang}
                    htmlFor={`lang-${lang}`}
                    className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                      language === lang
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value={lang} id={`lang-${lang}`} className="sr-only" />
                    <span className="text-sm font-medium">{languageNames[lang]}</span>
                  </Label>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground mt-3">
                {t("settings.language.desc")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Tab */}
        <TabsContent value="ai" className="space-y-6">
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
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup">
          {user && <BackupRestoreSection userId={user.id} />}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
