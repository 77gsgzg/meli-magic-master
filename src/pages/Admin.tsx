import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldOff,
  Unplug,
  RefreshCcw,
  Store,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface AdminUser {
  id: string;
  masked_email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  roles: string[];
  is_admin: boolean;
  ml_connected: boolean;
  ml_nickname: string | null;
}

type ConfirmAction =
  | { type: "promote"; user: AdminUser }
  | { type: "demote"; user: AdminUser }
  | { type: "revoke_ml"; user: AdminUser }
  | null;

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/", { replace: true });
    }
  }, [isAdmin, roleLoading, navigate]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-manage", {
      body: { action: "list_users", limit: 100, page: 1 },
    });
    if (error) {
      toast.error("Erro ao carregar usuários", { description: error.message });
      setLoading(false);
      return;
    }
    setUsers(data?.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  async function runAction(action: ConfirmAction) {
    if (!action) return;
    const { type, user } = action;
    setBusyId(user.id);
    const actionMap = {
      promote: "promote_admin",
      demote: "demote_admin",
      revoke_ml: "revoke_ml_token",
    } as const;
    const { error } = await supabase.functions.invoke("admin-manage", {
      body: { action: actionMap[type], user_id: user.id },
    });
    setBusyId(null);
    setConfirm(null);
    if (error) {
      toast.error("Falha na operação", { description: error.message });
      return;
    }
    toast.success("Operação concluída");
    load();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Painel Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão de usuários, papéis e integrações. Toda ação é validada no backend.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Usuários ({users.length})
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
                  <TableHead>Mercado Livre</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">
                      <div className="font-sans text-sm">{u.masked_email}</div>
                      <div className="text-muted-foreground">
                        {u.id.slice(0, 8)}…{u.id.slice(-4)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.confirmed ? (
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
                    <TableCell>
                      {u.ml_connected ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Store className="h-3.5 w-3.5 text-success" />
                          {u.ml_nickname ?? "Conectado"}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {u.is_admin ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === u.id}
                          onClick={() => setConfirm({ type: "demote", user: u })}
                        >
                          <ShieldOff className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === u.id}
                          onClick={() => setConfirm({ type: "promote", user: u })}
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                      )}
                      {u.ml_connected && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === u.id}
                          onClick={() =>
                            setConfirm({ type: "revoke_ml", user: u })
                          }
                          title="Revogar token Mercado Livre"
                        >
                          <Unplug className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
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

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "promote" &&
                `Promover ${confirm.user.masked_email} a administrador?`}
              {confirm?.type === "demote" &&
                `Remover privilégios de admin de ${confirm.user.masked_email}?`}
              {confirm?.type === "revoke_ml" &&
                `Revogar token do Mercado Livre de ${confirm.user.masked_email}? O usuário precisará reconectar.`}
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
    </div>
  );
}
