import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Activity, Download, Filter, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

type OperationLogRow = {
  id: string;
  created_at: string;
  status: string;
  operation_type: string;
  entity_type: string | null;
  entity_id: string | null;
  duration_ms: number | null;
  error_message: string | null;
  details: any;
};

const PAGE_SIZE = 25;

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function rowToCSV(row: OperationLogRow): string {
  return [
    row.id,
    row.created_at,
    row.operation_type,
    row.status,
    row.entity_type || "",
    row.entity_id || "",
    row.duration_ms ?? "",
    (row.error_message || "").replace(/"/g, '""'),
    JSON.stringify(row.details || {}).replace(/"/g, '""'),
  ]
    .map((v) => `"${v}"`)
    .join(",");
}

export default function OperationLogs() {
  const { user, loading: authLoading } = useRequireAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<OperationLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [status, setStatus] = useState<string>("all");
  const [opType, setOpType] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>(searchParams.get("search") || "");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OperationLogRow | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const operationTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.operation_type && set.add(r.operation_type));
    return Array.from(set).sort();
  }, [rows]);

  // Sync search with URL param
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    if (urlSearch && urlSearch !== search) {
      setSearch(urlSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!user?.id) return;

    const fetchRows = async () => {
      setLoading(true);
      try {
        let q = supabase
          .from("operation_logs")
          .select("*", { count: "exact" })
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

        if (status !== "all") q = q.eq("status", status);
        if (opType !== "all") q = q.eq("operation_type", opType as any);

        if (startDate) q = q.gte("created_at", new Date(`${startDate}T00:00:00`).toISOString());
        if (endDate) {
          const end = new Date(`${endDate}T23:59:59`);
          q = q.lte("created_at", end.toISOString());
        }

        if (search) {
          const like = `%${search}%`;
          q = q.or(`error_message.ilike.${like},entity_id.ilike.${like},entity_type.ilike.${like},id.ilike.${like}`);
        }

        const { data, error, count } = await q;
        if (error) throw error;

        setRows((data || []) as any);
        setTotalCount(count ?? 0);
      } catch (e: any) {
        console.error(e);
        toast.error("Erro ao carregar eventos", { description: e?.message });
      } finally {
        setLoading(false);
      }
    };

    fetchRows();
  }, [user?.id, page, status, opType, startDate, endDate, search]);

  const refetch = () => {
    setPage(1);
    setRows([]);
    setLoading(true);
    // re-trigger effect
    setTotalCount(0);
  };

  const exportCSV = () => {
    if (rows.length === 0) {
      toast.info("Nenhum dado para exportar.");
      return;
    }
    const header = "id,created_at,operation_type,status,entity_type,entity_id,duration_ms,error_message,details";
    const csv = [header, ...rows.map(rowToCSV)].join("\n");
    downloadFile(csv, `events_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
    toast.success("CSV exportado!");
  };

  const exportJSON = () => {
    if (rows.length === 0) {
      toast.info("Nenhum dado para exportar.");
      return;
    }
    const json = JSON.stringify(rows, null, 2);
    downloadFile(json, `events_${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    toast.success("JSON exportado!");
  };

  if (authLoading) {
    return (
      <DashboardLayout title="Auditoria" subtitle="Carregando...">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Auditoria" subtitle="Filtros + detalhes + exportação">
      <div className="space-y-4">
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filtros
            </CardTitle>
            <CardDescription>Filtre por tipo, status e período; clique em um evento para ver detalhes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-1">
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">success</SelectItem>
                  <SelectItem value="error">error</SelectItem>
                  <SelectItem value="info">info</SelectItem>
                  <SelectItem value="running">running</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1">
              <p className="text-sm text-muted-foreground mb-1">Tipo</p>
              <Select value={opType} onValueChange={setOpType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {operationTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1">
              <p className="text-sm text-muted-foreground mb-1">De</p>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="md:col-span-1">
              <p className="text-sm text-muted-foreground mb-1">Até</p>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div className="md:col-span-1">
              <p className="text-sm text-muted-foreground mb-1">Buscar</p>
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                    if (e.target.value) {
                      setSearchParams({ search: e.target.value });
                    } else {
                      setSearchParams({});
                    }
                  }}
                  className="pl-9"
                  placeholder="id, entity_id, erro..."
                />
              </div>
            </div>

            <div className="md:col-span-1 flex items-end gap-2">
              <Button variant="outline" onClick={refetch} disabled={loading} className="flex-1">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportCSV}>Exportar CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportJSON}>Exportar JSON</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Eventos
            </CardTitle>
            <CardDescription>
              {totalCount} registro(s) • Página {page} de {totalPages}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Nenhum evento encontrado.</div>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border/50 overflow-hidden">
                {rows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full text-left p-3 bg-background/40 hover:bg-background/60 transition-colors"
                    onClick={() => {
                      setSelected(r);
                      setOpen(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.operation_type} • {r.entity_type || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {new Date(r.created_at).toLocaleString("pt-BR")} • {r.entity_id || "—"}
                          {r.error_message ? ` • ${r.error_message}` : ""}
                        </p>
                      </div>
                      <Badge variant={r.status === "error" ? "destructive" : "outline"}>{r.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </CardContent>
        </Card>

        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>Detalhes do evento</DrawerTitle>
              <DrawerDescription>
                {selected?.operation_type} • {selected?.status} • {selected?.id}
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-4 pb-6 space-y-3 overflow-auto">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Quando</p>
                  <p className="text-sm font-medium">
                    {selected?.created_at ? new Date(selected.created_at).toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Duração</p>
                  <p className="text-sm font-medium">
                    {selected?.duration_ms == null ? "—" : `${selected.duration_ms} ms`}
                  </p>
                </div>
              </div>

              {selected?.error_message && (
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Erro</p>
                  <p className="text-sm">{selected.error_message}</p>
                </div>
              )}

              <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground mb-2">Details (JSON)</p>
                <pre className="text-xs overflow-auto whitespace-pre-wrap break-words max-h-64">
                  {JSON.stringify(selected?.details ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </DashboardLayout>
  );
}
