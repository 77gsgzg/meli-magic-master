import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { handleAdminError } from "@/lib/adminErrors";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ShieldCheck,
  ShieldOff,
  Unplug,
  RefreshCcw,
  Store,
  CheckCircle2,
  XCircle,
  Users,
  Activity,
  Crown,
  Ban,
  PauseCircle,
  PlayCircle,
  MessageSquare,
  Search,
} from "lucide-react";

interface AdminUser {
  id: string;
  masked_email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  banned_until: string | null;
  is_banned: boolean;
  roles: string[];
  is_admin: boolean;
  ml_connected: boolean;
  ml_nickname: string | null;
  plan_type: "free" | "pro" | "premium";
  plan_status: "active" | "expired" | "canceled";
  plan_expires_at: string | null;
}

interface DashStats {
  total_users: number;
  active_users_30d: number;
  paying_users: number;
  ml_connected: number;
}

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  admin_reply: string | null;
  status: "open" | "answered" | "closed";
  created_at: string;
  replied_at: string | null;
  masked_email: string;
}

type ConfirmAction =
  | { type: "promote"; user: AdminUser }
  | { type: "demote"; user: AdminUser }
  | { type: "revoke_ml"; user: AdminUser }
  | { type: "ban"; user: AdminUser }
  | { type: "suspend"; user: AdminUser }
  | { type: "reactivate"; user: AdminUser }
  | null;

const planColors: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/15 text-primary border-primary/30",
  premium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
};

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Plan editor
  const [planEdit, setPlanEdit] = useState<AdminUser | null>(null);
  const [planForm, setPlanForm] = useState({
    plan_type: "free",
    status: "active",
    expires_at: "",
  });

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<string>("all");
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotal, setTicketTotal] = useState(0);
  const TICKETS_PER_PAGE = 20;
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [replyTicket, setReplyTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyClose, setReplyClose] = useState(false);

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate("/", { replace: true });
  }, [isAdmin, roleLoading, navigate]);

  async function loadStats() {
    const { data } = await supabase.functions.invoke("admin-manage", {
      body: { action: "dashboard_stats" },
    });
    if (data) setStats(data);
  }

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-manage", {
      body: {
        action: "list_users",
        limit: 200,
        page: 1,
        search,
        filter_plan: filterPlan,
        filter_admin: filterRole === "admin",
      },
    });
    if (error) {
      toast.error("Erro ao carregar usuários", { description: error.message });
      setLoading(false);
      return;
    }
    setUsers(data?.users ?? []);
    setLoading(false);
  }

  async function loadTickets() {
    setTicketsLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-manage", {
      body: {
        action: "list_tickets",
        status: ticketStatus,
        search: ticketSearch.trim(),
        limit: TICKETS_PER_PAGE,
        page: ticketPage,
      },
    });
    if (error) {
      handleAdminError(error, "Erro ao carregar tickets");
    } else {
      setTickets(data?.tickets ?? []);
      setTicketTotal(data?.total ?? 0);
    }
    setTicketsLoading(false);
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadStats();
    loadUsers();
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // re-filter on changes (debounced minimal)
  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterPlan, filterRole]);

  useEffect(() => {
    if (!isAdmin) return;
    setSelectedTickets(new Set());
    const t = setTimeout(loadTickets, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketStatus, ticketSearch, ticketPage]);

  const filteredUsers = useMemo(() => {
    if (filterStatus === "all") return users;
    if (filterStatus === "banned") return users.filter((u) => u.is_banned);
    if (filterStatus === "active")
      return users.filter((u) => !u.is_banned && u.confirmed);
    if (filterStatus === "pending") return users.filter((u) => !u.confirmed);
    return users;
  }, [users, filterStatus]);

  async function runAction(a: ConfirmAction) {
    if (!a) return;
    const { type, user } = a;
    setBusyId(user.id);
    const map: Record<string, string> = {
      promote: "promote_admin",
      demote: "demote_admin",
      revoke_ml: "revoke_ml_token",
      ban: "ban_user",
      suspend: "suspend_user",
      reactivate: "reactivate_user",
    };
    const body: Record<string, unknown> = {
      action: map[type],
      user_id: user.id,
    };
    if (type === "suspend") body.days = 7;

    const { error } = await supabase.functions.invoke("admin-manage", { body });
    setBusyId(null);
    setConfirm(null);
    if (error) {
      toast.error("Falha", { description: error.message });
      return;
    }
    toast.success("Operação concluída");
    loadUsers();
    loadStats();
  }

  function openPlanEdit(u: AdminUser) {
    setPlanEdit(u);
    setPlanForm({
      plan_type: u.plan_type,
      status: u.plan_status,
      expires_at: u.plan_expires_at ? u.plan_expires_at.slice(0, 10) : "",
    });
  }

  async function savePlan() {
    if (!planEdit) return;
    const { error } = await supabase.functions.invoke("admin-manage", {
      body: {
        action: "update_plan",
        user_id: planEdit.id,
        plan_type: planForm.plan_type,
        status: planForm.status,
        expires_at: planForm.expires_at
          ? new Date(planForm.expires_at).toISOString()
          : null,
      },
    });
    if (error) {
      toast.error("Falha ao salvar plano", { description: error.message });
      return;
    }
    toast.success("Plano atualizado");
    setPlanEdit(null);
    loadUsers();
    loadStats();
  }

  async function sendReply() {
    if (!replyTicket || !replyText.trim()) return;
    const { error } = await supabase.functions.invoke("admin-manage", {
      body: {
        action: "reply_ticket",
        ticket_id: replyTicket.id,
        reply: replyText.trim(),
        close: replyClose,
      },
    });
    if (error) {
      toast.error("Falha", { description: error.message });
      return;
    }
    toast.success("Resposta enviada");
    setReplyTicket(null);
    setReplyText("");
    setReplyClose(false);
    loadTickets();
  }

  async function changeTicketStatus(ticket_id: string, status: string) {
    const { error } = await supabase.functions.invoke("admin-manage", {
      body: { action: "change_ticket_status", ticket_id, status },
    });
    if (error) {
      toast.error("Sem permissão", { description: error.message });
      return;
    }
    toast.success("Status atualizado");
    loadTickets();
  }

  if (roleLoading || !isAdmin) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Painel Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão de usuários, planos e suporte. Toda ação validada no backend.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadStats();
            loadUsers();
            loadTickets();
          }}
          disabled={loading}
        >
          <RefreshCcw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Total"
          value={stats?.total_users ?? "—"}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Ativos (30d)"
          value={stats?.active_users_30d ?? "—"}
        />
        <KpiCard
          icon={<Crown className="h-4 w-4" />}
          label="Pagantes"
          value={stats?.paying_users ?? "—"}
        />
        <KpiCard
          icon={<Store className="h-4 w-4" />}
          label="ML Conectado"
          value={stats?.ml_connected ?? "—"}
        />
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="support">
            Suporte
            {tickets.filter((t) => t.status === "open").length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5">
                {tickets.filter((t) => t.status === "open").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* USERS */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2 relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID ou e-mail…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os planos</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="admin">Apenas admins</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="banned">Banidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Usuários ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID / E-mail</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>ML</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow
                        key={u.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate(`/admin/user/${u.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="text-sm">{u.masked_email}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {u.id.slice(0, 8)}…{u.id.slice(-4)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.is_banned ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-destructive/40 text-destructive"
                            >
                              <Ban className="h-3 w-3" /> Banido
                            </Badge>
                          ) : u.confirmed ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <XCircle className="h-3 w-3" /> Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.is_admin ? (
                            <Badge className="bg-primary/15 text-primary border-primary/30">
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline">User</Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openPlanEdit(u)}
                            className="text-left"
                          >
                            <Badge
                              className={`${planColors[u.plan_type]} cursor-pointer hover:opacity-80`}
                            >
                              {u.plan_type.toUpperCase()}
                            </Badge>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {u.plan_status}
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>
                          {u.ml_connected ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Store className="h-3.5 w-3.5 text-success" />
                              <span className="truncate max-w-[100px]">
                                {u.ml_nickname ?? "Conectado"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1 flex-wrap">
                            {u.is_admin ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === u.id}
                                title="Remover admin"
                                onClick={() =>
                                  setConfirm({ type: "demote", user: u })
                                }
                              >
                                <ShieldOff className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === u.id}
                                title="Promover admin"
                                onClick={() =>
                                  setConfirm({ type: "promote", user: u })
                                }
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </Button>
                            )}
                            {u.is_banned ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === u.id}
                                title="Reativar"
                                onClick={() =>
                                  setConfirm({ type: "reactivate", user: u })
                                }
                              >
                                <PlayCircle className="h-4 w-4 text-success" />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busyId === u.id}
                                  title="Suspender 7 dias"
                                  onClick={() =>
                                    setConfirm({ type: "suspend", user: u })
                                  }
                                >
                                  <PauseCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busyId === u.id}
                                  title="Banir"
                                  onClick={() =>
                                    setConfirm({ type: "ban", user: u })
                                  }
                                >
                                  <Ban className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                            {u.ml_connected && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === u.id}
                                title="Revogar ML"
                                onClick={() =>
                                  setConfirm({ type: "revoke_ml", user: u })
                                }
                              >
                                <Unplug className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          Nenhum usuário encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUPPORT */}
        <TabsContent value="support" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Tickets de suporte ({tickets.length})
              </CardTitle>
              <Select value={ticketStatus} onValueChange={setTicketStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abertos</SelectItem>
                  <SelectItem value="answered">Respondidos</SelectItem>
                  <SelectItem value="closed">Fechados</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticketsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : tickets.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Nenhum ticket.
                </div>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    className="border border-border/60 rounded-lg p-4 space-y-2 bg-card/40"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            t.status === "open"
                              ? "default"
                              : t.status === "answered"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {t.status}
                        </Badge>
                        <span className="text-sm font-medium">{t.subject}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {t.masked_email} •{" "}
                        {new Date(t.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {t.message}
                    </p>
                    {t.admin_reply && (
                      <div className="text-sm bg-primary/5 border-l-2 border-primary p-2 rounded">
                        <div className="text-xs text-primary font-semibold mb-1">
                          Resposta do admin:
                        </div>
                        <p className="whitespace-pre-wrap">{t.admin_reply}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyTicket(t);
                            setReplyText(t.admin_reply ?? "");
                          }}
                        >
                          {t.admin_reply ? "Editar resposta" : "Responder"}
                        </Button>
                      )}
                      <Select
                        value={t.status}
                        onValueChange={(v) => changeTicketStatus(t.id, v)}
                      >
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Aguardando</SelectItem>
                          <SelectItem value="answered">Respondido</SelectItem>
                          <SelectItem value="closed">Fechado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/admin/user/${t.user_id}`)}
                      >
                        Ver usuário
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm dialog */}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "promote" &&
                `Promover ${confirm.user.masked_email} a administrador?`}
              {confirm?.type === "demote" &&
                `Remover privilégios de admin de ${confirm.user.masked_email}?`}
              {confirm?.type === "revoke_ml" &&
                `Revogar token Mercado Livre de ${confirm.user.masked_email}?`}
              {confirm?.type === "ban" &&
                `Banir ${confirm.user.masked_email} permanentemente? Eles não poderão mais entrar.`}
              {confirm?.type === "suspend" &&
                `Suspender ${confirm.user.masked_email} por 7 dias?`}
              {confirm?.type === "reactivate" &&
                `Reativar acesso de ${confirm.user.masked_email}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => runAction(confirm)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plan editor */}
      <Dialog open={!!planEdit} onOpenChange={(o) => !o && setPlanEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar plano</DialogTitle>
            <DialogDescription>{planEdit?.masked_email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select
                value={planForm.plan_type}
                onValueChange={(v) =>
                  setPlanForm((p) => ({ ...p, plan_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select
                value={planForm.status}
                onValueChange={(v) =>
                  setPlanForm((p) => ({ ...p, status: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Expira em (opcional)
              </label>
              <Input
                type="date"
                value={planForm.expires_at}
                onChange={(e) =>
                  setPlanForm((p) => ({ ...p, expires_at: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanEdit(null)}>
              Cancelar
            </Button>
            <Button onClick={savePlan}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply ticket */}
      <Dialog
        open={!!replyTicket}
        onOpenChange={(o) => !o && setReplyTicket(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder ticket</DialogTitle>
            <DialogDescription>{replyTicket?.subject}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm bg-muted/40 p-3 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
              {replyTicket?.message}
            </div>
            <Textarea
              placeholder="Sua resposta…"
              rows={5}
              maxLength={5000}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={replyClose}
                onChange={(e) => setReplyClose(e.target.checked)}
              />
              Fechar ticket após responder
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyTicket(null)}>
              Cancelar
            </Button>
            <Button onClick={sendReply} disabled={!replyText.trim()}>
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
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
