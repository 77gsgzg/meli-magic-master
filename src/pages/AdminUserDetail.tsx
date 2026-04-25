import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  ShieldCheck,
  Crown,
  Mail,
  Calendar,
  Store,
  Package,
  ShoppingCart,
  TrendingUp,
  Image as ImageIcon,
  FileText,
  Wand2,
  Activity,
  MessageSquare,
  History as HistoryIcon,
  Ban,
  CheckCircle2,
  XCircle,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Unplug,
} from "lucide-react";
import { handleAdminError } from "@/lib/adminErrors";
import { exportUserDetailCSV, exportUserDetailPDF } from "@/utils/exportAdminUserDetail";
import { toast } from "sonner";

interface UserDetail {
  user: {
    id: string;
    masked_email: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    confirmed: boolean;
    is_banned: boolean;
    is_admin: boolean;
    roles: string[];
    ban_reason?: string | null;
    ban_action?: string | null;
    ban_at?: string | null;
  };
  plan: { plan_type: string; status: string; expires_at: string | null };
  ml_integration:
    | { connected: false; last_revoke_reason?: string | null; last_revoke_trigger?: string | null; last_revoke_at?: string | null }
    | { connected: true; nickname: string | null; expires_at: string; updated_at: string };
  products_count: number;
  top_products: any[];
  low_products: any[];
  sales: { total_orders: number; total_revenue: number; avg_ticket: number };
  usage: { ai_images: number; ai_texts: number; ai_edits: number };
  logs: any[];
  tickets: any[];
  audit_logs: any[];
}

function fmtBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR");
}

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate("/", { replace: true });
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (!isAdmin || !id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: res, error: err } = await supabase.functions.invoke(
        "admin-manage",
        { body: { action: "user_detail", user_id: id } },
      );
      if (!alive) return;
      if (err) setError(err.message);
      else setData(res as UserDetail);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin, id]);

  if (roleLoading || loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {error ?? "Usuário não encontrado."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, plan, ml_integration, sales, usage } = data;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Usuário
        </h1>
      </div>

      {/* SECTION 1 — General info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações gerais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Field label="ID" mono value={user.id} />
          <Field
            icon={<Mail className="h-3.5 w-3.5" />}
            label="E-mail"
            value={user.masked_email}
          />
          <Field label="Nome" value={user.full_name ?? "—"} />
          <Field
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Criado em"
            value={fmtDate(user.created_at)}
          />
          <Field label="Último acesso" value={fmtDate(user.last_sign_in_at)} />
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Status
            </div>
            <div className="flex flex-wrap gap-1.5">
              {user.is_banned ? (
                <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                  <Ban className="h-3 w-3" /> Banido
                </Badge>
              ) : user.confirmed ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Ativo
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <XCircle className="h-3 w-3" /> Pendente
                </Badge>
              )}
              {user.is_admin && (
                <Badge className="gap-1 bg-primary/15 text-primary border-primary/30">
                  <Crown className="h-3 w-3" /> Admin
                </Badge>
              )}
              <Badge variant="outline" className="uppercase">
                {plan.plan_type}
              </Badge>
              <Badge variant="outline">{plan.status}</Badge>
              {plan.expires_at && (
                <Badge variant="outline">
                  exp. {new Date(plan.expires_at).toLocaleDateString("pt-BR")}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={<Package className="h-4 w-4" />}
          label="Produtos"
          value={data.products_count}
        />
        <Kpi
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Pedidos"
          value={sales.total_orders}
        />
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Receita"
          value={fmtBRL(sales.total_revenue)}
        />
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Ticket médio"
          value={fmtBRL(sales.avg_ticket)}
        />
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="usage">Uso</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="tickets">Suporte</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        {/* SECTION 2 — Products */}
        <TabsContent value="products" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mais vendidos</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <ProductTable rows={data.top_products} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Menos vendidos</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <ProductTable rows={data.low_products} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 4 — Integrations */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4" /> Mercado Livre
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {ml_integration.connected ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>Conectado</span>
                  </div>
                  <Field label="Nickname" value={ml_integration.nickname ?? "—"} />
                  <Field
                    label="Token expira em"
                    value={fmtDate(ml_integration.expires_at)}
                  />
                  <Field
                    label="Atualizado em"
                    value={fmtDate(ml_integration.updated_at)}
                  />
                  <p className="text-xs text-muted-foreground pt-2">
                    Tokens não são exibidos por segurança. Use as ações no painel
                    principal para revogar.
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-4 w-4" /> Não conectado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 5 — Usage */}
        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uso de IA</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Kpi
                icon={<ImageIcon className="h-4 w-4" />}
                label="Imagens geradas"
                value={usage.ai_images}
              />
              <Kpi
                icon={<FileText className="h-4 w-4" />}
                label="Textos gerados"
                value={usage.ai_texts}
              />
              <Kpi
                icon={<Wand2 className="h-4 w-4" />}
                label="Edições de imagem"
                value={usage.ai_edits}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 6 — Logs */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Últimas atividades
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sem registros.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">
                          {fmtDate(l.created_at)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.operation_type}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={l.status === "success" ? "secondary" : "outline"}
                            className={
                              l.status === "error"
                                ? "border-destructive/40 text-destructive"
                                : ""
                            }
                          >
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.entity_type ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-destructive max-w-[280px] truncate">
                          {l.error_message ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 7 — Tickets */}
        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Tickets do usuário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum ticket.
                </p>
              ) : (
                data.tickets.map((t) => (
                  <div
                    key={t.id}
                    className="border border-border/60 rounded-lg p-3 bg-card/40"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{t.status}</Badge>
                        <span className="text-sm font-medium">{t.subject}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(t.created_at)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground mt-1">
                      {t.message}
                    </p>
                    {t.admin_reply && (
                      <div className="text-sm bg-primary/5 border-l-2 border-primary p-2 rounded mt-2">
                        <div className="text-xs text-primary font-semibold mb-1">
                          Resposta do admin · {fmtDate(t.replied_at)}
                        </div>
                        <p className="whitespace-pre-wrap">{t.admin_reply}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HistoryIcon className="h-4 w-4" /> Auditoria administrativa
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.audit_logs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sem ações administrativas registradas.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.audit_logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">
                          {fmtDate(l.created_at)}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {l.action}
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.reason ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate">
                          {l.details ? JSON.stringify(l.details) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={mono ? "font-mono text-xs break-all" : "text-sm"}>
        {value}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function ProductTable({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Sem produtos.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead className="text-right">Preço</TableHead>
          <TableHead className="text-right">Estoque</TableHead>
          <TableHead className="text-right">Vendas</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="text-sm max-w-[280px] truncate">
              {p.title}
            </TableCell>
            <TableCell className="text-right text-sm">
              {p.price ? fmtBRL(Number(p.price)) : "—"}
            </TableCell>
            <TableCell className="text-right text-sm">
              {p.available_quantity ?? 0}
            </TableCell>
            <TableCell className="text-right text-sm">{p.sales ?? 0}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {p.status ?? "—"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
