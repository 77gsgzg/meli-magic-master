import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Zap,
  ShieldCheck,
  BarChart3,
  Bot,
  Boxes,
  LineChart,
  Workflow,
  Check,
  Store,
  Activity,
  TrendingUp,
  Package,
  CircleDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/* Cinematic ML Manager landing — operational AI command center vibe          */
/* -------------------------------------------------------------------------- */

const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const featureList = [
  {
    icon: Bot,
    title: "Automação com IA",
    desc: "Publica, otimiza e re-precifica seus anúncios 24/7 com modelos de linguagem treinados para Mercado Livre.",
  },
  {
    icon: LineChart,
    title: "Inteligência de vendas",
    desc: "Funil Pago → Enviado → Entregue, projeções MoM/QoQ e alertas de queda em tempo real.",
  },
  {
    icon: Workflow,
    title: "Pipeline de fornecedores",
    desc: "Re-scraping periódico, sincronização de preços e detecção automática de oportunidades de margem.",
  },
  {
    icon: Boxes,
    title: "Estoque preditivo",
    desc: "Previsão de demanda por SKU com Gemini AI e alertas de ruptura via e-mail e push.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança de PII",
    desc: "Dados de compradores criptografados em AES-256-GCM. OAuth oficial, tokens cifrados.",
  },
  {
    icon: BarChart3,
    title: "Relatórios executivos",
    desc: "PDFs com KPIs, ROI de campanhas e recomendações acionáveis em um clique.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "R$ 0",
    period: "/ para começar",
    desc: "Para sellers explorando automação inteligente.",
    features: [
      "Conexão oficial com Mercado Livre",
      "Até 50 produtos monitorados",
      "Dashboard operacional completo",
      "Alertas básicos por e-mail",
    ],
    cta: "Criar conta",
    highlighted: false,
  },
  {
    name: "Operator",
    price: "R$ 149",
    period: "/ mês",
    desc: "Para operações sérias que querem escalar com IA.",
    features: [
      "Produtos ilimitados",
      "Geração de conteúdo com IA",
      "Sincronização de preços em tempo real",
      "Previsão de demanda + restock alerts",
      "Relatórios em PDF agendados",
    ],
    cta: "Começar agora",
    highlighted: true,
  },
  {
    name: "Command",
    price: "Sob consulta",
    period: "",
    desc: "Para grandes operações com múltiplas contas ML.",
    features: [
      "Multi-conta Mercado Livre",
      "API dedicada e webhooks",
      "Workflows de fornecedor avançados",
      "Onboarding white-glove + SLA",
    ],
    cta: "Falar com vendas",
    highlighted: false,
  },
];

const testimonials = [
  {
    quote:
      "Em duas semanas, o ML Manager reduziu nosso tempo operacional em 70%. A IA reprecifica enquanto dormimos.",
    name: "Camila Reis",
    role: "Head of Marketplace · Eletrônicos",
  },
  {
    quote:
      "A previsão de demanda evitou três rupturas de estoque na Black Friday. Pagou o plano em uma semana.",
    name: "Rafael Tonin",
    role: "Diretor de Operações · Moda",
  },
  {
    quote:
      "Sai do operacional braçal e voltei a pensar em estratégia. É um copiloto, não uma planilha.",
    name: "Bruno Maia",
    role: "Founder · Distribuidora Premium",
  },
];

/* ------------------------------------ */
/*  Components                          */
/* ------------------------------------ */

function GridBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* radial spotlight */}
      <div className="absolute left-1/2 top-[-10%] h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
      <div className="absolute right-[-10%] top-1/3 h-[400px] w-[400px] rounded-full bg-info/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-5%] h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />

      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at center top, black 30%, transparent 75%)",
        }}
      />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
            <Store className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              ML Manager
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              AI Operations
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Plataforma
          </a>
          <a href="#dashboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Dashboard
          </a>
          <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Planos
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild size="sm" variant="glow">
            <Link to="/auth">
              Começar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
      <GridBackdrop />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs text-primary backdrop-blur-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Plataforma de operações com IA para Mercado Livre
          </motion.div>

          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
          >
            Domine o Mercado Livre{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-info bg-clip-text text-transparent">
              com IA operacional
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Um centro de comando autônomo que publica, precifica, monitora estoque e prevê demanda
            por você — em tempo real, com a precisão de uma mesa de operações financeiras.
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button asChild size="xl" variant="glow">
              <Link to="/auth">
                Acessar plataforma
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="glass">
              <a href="#dashboard">Ver dashboard</a>
            </Button>
          </motion.div>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 flex items-center justify-center gap-6 text-xs text-muted-foreground"
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success))]" />
              API oficial ML
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              AES-256-GCM
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Sync 15min
            </div>
          </motion.div>
        </motion.div>

        {/* Dashboard mockup */}
        <DashboardMockup />
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <motion.div
      id="dashboard"
      initial={{ opacity: 0, y: 60, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto mt-20 max-w-6xl"
    >
      {/* glow */}
      <div className="absolute inset-x-12 -top-6 -bottom-6 rounded-[2rem] bg-gradient-to-r from-primary/40 via-info/30 to-primary/40 opacity-40 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-[0_30px_80px_-20px_hsl(225_15%_2%/0.9)] backdrop-blur-xl">
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-border/60 bg-background/60 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <div className="rounded-md border border-border/40 bg-muted/50 px-3 py-0.5 text-[10px] font-mono text-muted-foreground">
            mlmanager.app/dashboard
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            ML conectado
          </div>
        </div>

        {/* fake dashboard */}
        <div className="grid grid-cols-12 gap-3 p-4 sm:gap-4 sm:p-6">
          {/* sidebar */}
          <aside className="col-span-2 hidden flex-col gap-1 border-r border-border/40 pr-3 md:flex">
            {["Dashboard", "Pedidos", "Produtos", "Fornecedores", "IA", "Relatórios"].map((it, i) => (
              <div
                key={it}
                className={`rounded-md px-2 py-1.5 text-[11px] ${
                  i === 0
                    ? "bg-primary/15 text-primary border border-primary/25"
                    : "text-muted-foreground"
                }`}
              >
                {it}
              </div>
            ))}
          </aside>

          {/* main */}
          <div className="col-span-12 md:col-span-10 space-y-4">
            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Receita 30d", value: "R$ 284k", trend: "+12.4%", icon: CircleDollarSign },
                { label: "Pedidos hoje", value: "1.847", trend: "+8.1%", icon: Package },
                { label: "Conversão", value: "4.62%", trend: "+0.4pp", icon: TrendingUp },
                { label: "SKUs ativos", value: "12.3k", trend: "+312", icon: Activity },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-background/40 p-3"
                >
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] uppercase tracking-wide">{k.label}</span>
                    <k.icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="mt-1.5 text-lg font-bold tabular-nums text-foreground sm:text-xl">
                    {k.value}
                  </div>
                  <div className="text-[10px] text-success">{k.trend}</div>
                </div>
              ))}
            </div>

            {/* chart + side panel */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 rounded-lg border border-border/50 bg-card/60 p-3 lg:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Receita por dia</span>
                  <span className="text-[10px] text-muted-foreground">últimos 30 dias</span>
                </div>
                <FakeChart />
              </div>
              <div className="col-span-3 space-y-2 rounded-lg border border-border/50 bg-card/60 p-3 lg:col-span-1">
                <span className="text-xs font-medium text-foreground">Automação IA</span>
                {[
                  { label: "Reprecificações", n: "1.284", color: "primary" },
                  { label: "Títulos otimizados", n: "318", color: "info" },
                  { label: "Alertas estoque", n: "47", color: "warning" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-mono font-semibold text-foreground">{row.n}</span>
                  </div>
                ))}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/50">
                  <div className="h-full w-[78%] bg-gradient-to-r from-primary to-info" />
                </div>
                <div className="text-[10px] text-muted-foreground">78% capacidade IA usada</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FakeChart() {
  const bars = [42, 55, 48, 70, 62, 80, 75, 92, 85, 96, 88, 110, 102, 120];
  const max = Math.max(...bars);
  return (
    <div className="flex h-24 items-end gap-1.5">
      {bars.map((v, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.03, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: `${(v / max) * 100}%`, transformOrigin: "bottom" }}
          className="flex-1 rounded-sm bg-gradient-to-t from-primary/40 via-primary/70 to-info"
        />
      ))}
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" /> Plataforma operacional
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Um sistema, todas as decisões.
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Substitua planilhas, dashboards isolados e bots improvisados por uma única camada
            inteligente conectada à API oficial do Mercado Livre.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureList.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card to-background/30 p-6 transition-all hover:border-primary/40 hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.4)]"
            >
              <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Operações reais. Resultados mensuráveis.
        </h2>
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm"
            >
              <blockquote className="text-sm leading-relaxed text-foreground">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-5 border-t border-border/40 pt-4">
                <div className="text-sm font-semibold text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Planos para cada estágio de operação.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Comece grátis. Escale quando a operação pedir IA pesada.
          </p>
        </div>

        <div className="mt-16 grid gap-4 lg:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                p.highlighted
                  ? "border-primary/50 bg-gradient-to-b from-primary/10 to-card shadow-[0_0_50px_-10px_hsl(var(--primary)/0.5)]"
                  : "border-border/60 bg-card/60"
              }`}
            >
              {p.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-primary/40 bg-background px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Mais popular
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-foreground">{p.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-foreground">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.period}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-8"
                variant={p.highlighted ? "glow" : "outline"}
                size="lg"
              >
                <Link to="/auth">{p.cta}</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/10 p-10 text-center sm:p-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/0.18),transparent_70%)]" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Sua próxima venda já está sendo otimizada.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              Ligue o ML Manager e veja o ciclo operacional inteiro acontecer no piloto automático.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="xl" variant="glow">
                <Link to="/auth">
                  Começar agora
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="glass">
                <a href="#features">Explorar a plataforma</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Store className="h-3.5 w-3.5 text-primary" />
          <span>© {new Date().getFullYear()} ML Manager — AI Operations for Mercado Livre.</span>
        </div>
        <div className="flex gap-5">
          <Link to="/auth" className="hover:text-foreground">Entrar</Link>
          <a href="#pricing" className="hover:text-foreground">Planos</a>
          <a href="#features" className="hover:text-foreground">Plataforma</a>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Nav />
      <main>
        <Hero />
        <Features />
        <Testimonials />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
