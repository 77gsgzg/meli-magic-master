import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useIsWalletAdmin } from "@/hooks/useIsWalletAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet as WalletIcon, Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Wallet() {
  const { isAdmin, loading: adminLoading } = useIsWalletAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, adminLoading, navigate]);

  const {
    balance,
    transactions,
    totalTransactions,
    loading,
    actionLoading,
    addCredit,
    refreshBalance,
    refreshTransactions,
  } = useWallet();

  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddCredit = async () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) return;
    await addCredit(amount, creditDescription || undefined);
    setCreditAmount("");
    setCreditDescription("");
    setDialogOpen(false);
  };

  const handleRefresh = () => {
    refreshBalance();
    refreshTransactions();
  };

  return (
    <DashboardLayout title="Carteira" subtitle="Gerencie seu saldo e transações">
      <div className="space-y-6 p-4 sm:p-6">
        {/* Balance Card */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <WalletIcon className="h-5 w-5 text-primary" />
              Carteira Interna
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Saldo disponível</p>
                {loading ? (
                  <div className="h-10 w-40 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-4xl font-bold text-foreground tracking-tight">
                    R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Crédito
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Crédito</DialogTitle>
                    <DialogDescription>
                      Informe o valor e uma descrição opcional para o crédito.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Valor (R$)</label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0,00"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Descrição (opcional)</label>
                      <Input
                        placeholder="Ex: Depósito inicial"
                        value={creditDescription}
                        onChange={(e) => setCreditDescription(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddCredit} disabled={actionLoading || !creditAmount}>
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Confirmar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <ArrowUpCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Créditos</p>
                  <p className="text-xl font-bold text-foreground">
                    {transactions.filter((t) => t.type === "credit").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <ArrowDownCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Débitos</p>
                  <p className="text-xl font-bold text-foreground">
                    {transactions.filter((t) => t.type === "debit").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <WalletIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Transações</p>
                  <p className="text-xl font-bold text-foreground">{totalTransactions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Transações</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <WalletIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma transação encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                      <TableHead className="hidden md:table-cell">Pedido</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Badge
                            variant={tx.type === "credit" ? "success" : "destructive"}
                            className="gap-1"
                          >
                            {tx.type === "credit" ? (
                              <ArrowUpCircle className="h-3 w-3" />
                            ) : (
                              <ArrowDownCircle className="h-3 w-3" />
                            )}
                            {tx.type === "credit" ? "Crédito" : "Débito"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          <span className={tx.type === "credit" ? "text-success" : "text-destructive"}>
                            {tx.type === "credit" ? "+" : "-"} R${" "}
                            {tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground max-w-[200px] truncate">
                          {tx.description || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-xs">
                          {tx.order_id ? tx.order_id.slice(0, 8) + "..." : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(tx.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
