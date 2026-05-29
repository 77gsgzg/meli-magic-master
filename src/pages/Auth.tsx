import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Store, ArrowRight, Shield, Zap, Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";
import { getRedirectFrom } from "@/lib/authRedirect";
import { logAuthEvent } from "@/lib/authTelemetry";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "A senha deve ter pelo menos 6 caracteres");

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading, initialized, signIn, signUp } = useAuth();

  // Destino para onde voltar após login (preservado pelo ProtectedRoute).
  // Suporta path + search + hash. Sanitizado para evitar loops em /auth.
  const fromPath = getRedirectFrom(location.state, "/");

  // Redirect if already logged in
  useEffect(() => {
    if (initialized && !loading && user) {
      logAuthEvent("redirect_to_auth", {
        source: "AuthPage",
        action: "already_authenticated_redirect",
        to: fromPath,
        userId: user.id,
      });
      navigate(fromPath, { replace: true });
    }
  }, [user, loading, initialized, navigate, fromPath]);

  // Handle ML OAuth callback
  useEffect(() => {
    const mlCode = searchParams.get("code");
    if (mlCode) {
      // Will be handled after login
      sessionStorage.setItem("ml_auth_code", mlCode);
    }
  }, [searchParams]);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (isLogin) {
        const { error, hasSession } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
          return;
        }
        logAuthEvent("redirect_to_auth", {
          source: "AuthPage",
          action: "post_login_redirect",
          to: fromPath,
          hasSession,
        });
        toast.success("Login realizado com sucesso!");
        navigate(fromPath, { replace: true });
      } else {
        const { error, hasSession } = await signUp(email, password, fullName);
        if (error) {
          toast.error(error.message);
          return;
        }
        if (!hasSession) {
          logAuthEvent("signup_resolved", {
            source: "AuthPage",
            requiresEmailConfirmation: true,
          });
          toast.success("Conta criada. Confirme seu email antes de entrar.");
          setIsLogin(true);
          return;
        }
        logAuthEvent("redirect_to_auth", {
          source: "AuthPage",
          action: "post_signup_redirect",
          to: fromPath,
          hasSession,
        });
        toast.success("Conta criada com sucesso!");
        navigate(fromPath, { replace: true });
      }
    } catch (error) {
      console.error("[auth-real-error]", error);
      logAuthEvent(isLogin ? "signin_exception" : "signup_exception", { message: String(error) });
      toast.error(error instanceof Error ? error.message : "Ocorreu um erro. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient cinematic backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-15%] h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-primary/20 blur-[160px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-info/15 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          }}
        />
      </div>

      <div className="relative flex min-h-screen">
        {/* Left — branding */}
        <div className="relative hidden flex-col justify-between p-12 lg:flex lg:w-1/2">
          <Link to="/" className="relative flex items-center gap-3 w-fit group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 shadow-[0_0_24px_hsl(var(--primary)/0.3)] transition-shadow group-hover:shadow-[0_0_36px_hsl(var(--primary)/0.5)]">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div className="leading-none">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">ML Manager</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
                AI Operations
              </p>
            </div>
          </Link>

          <div className="relative space-y-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs text-primary backdrop-blur-sm mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                Centro de comando para Mercado Livre
              </div>
              <h2 className="text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">
                Sua operação em{" "}
                <span className="bg-gradient-to-r from-primary via-primary to-info bg-clip-text text-transparent">
                  piloto automático
                </span>
              </h2>
              <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
                Acesse o painel onde IA, dados e automação operam juntos por você — em tempo real.
              </p>
            </div>

            <div className="space-y-4 max-w-sm">
              {[
                { icon: Zap, t: "Sincronização ML 24/7", d: "Pedidos, estoque e preços em ciclo de 15 minutos." },
                { icon: Sparkles, t: "IA aplicada ao catálogo", d: "Geração e otimização de conteúdo para SEO ML." },
                { icon: Shield, t: "Segurança operacional", d: "Tokens cifrados, PII em AES-256-GCM, OAuth oficial." },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="group flex items-start gap-3 rounded-xl border border-border/40 bg-card/40 p-3 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/70">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{t}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-xs text-muted-foreground">
            © {new Date().getFullYear()} ML Manager — AI Operations for Mercado Livre.
          </p>
        </div>

        {/* Right — form */}
        <div className="relative flex flex-1 items-center justify-center p-6 sm:p-10 lg:p-12">
          <Card variant="glass" className="w-full max-w-md border-border/60 shadow-[0_30px_80px_-20px_hsl(225_15%_2%/0.8)]">
            <CardHeader className="text-center">
              <Link to="/" className="flex justify-center mb-4 lg:hidden">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 shadow-[0_0_24px_hsl(var(--primary)/0.3)]">
                  <Store className="h-6 w-6 text-primary" />
                </div>
              </Link>
              <CardTitle className="text-2xl tracking-tight">
                {isLogin ? "Acessar plataforma" : "Criar conta"}
              </CardTitle>
              <CardDescription>
                {isLogin
                  ? "Entre para operar com IA no Mercado Livre"
                  : "Comece a automatizar sua operação ML agora"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input
                      id="name"
                      variant="glass"
                      placeholder="Seu nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    variant="glass"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: undefined });
                    }}
                    className={errors.email ? "border-destructive" : ""}
                    required
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      variant="glass"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors({ ...errors, password: undefined });
                      }}
                      className={errors.password ? "border-destructive" : ""}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <Button className="w-full" size="lg" variant="glow" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {isLogin ? "Entrando..." : "Criando conta..."}
                    </>
                  ) : (
                    <>
                      {isLogin ? "Entrar" : "Criar conta"}
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setErrors({});
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    {isLogin ? "Criar conta" : "Entrar"}
                  </button>
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  <Link to="/" className="hover:text-foreground transition-colors">
                    ← Voltar para a página inicial
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

