import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { MercadoLivreStatusIndicators } from "@/components/dashboard/MercadoLivreStatusIndicators";
import { Tables } from "@/integrations/supabase/types";

 type OperationLog = Tables<'operation_logs'>;

const PAGE_SIZE = 20;

const SecurityLogsPage = () => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [operationFilter, setOperationFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      let query = supabase
        .from('operation_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      if (operationFilter) {
        query = query.eq('operation_type', operationFilter as any);
      }

      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }

      if (search) {
        const like = `%${search}%`;
        query = query.or(`error_message.ilike.${like},entity_id.ilike.${like},entity_type.ilike.${like}`);
      }

      const { data, error, count } = await query;

      if (!error && data) {
        setLogs(data as OperationLog[]);
        setTotalCount(count ?? 0);
      }
      setLoading(false);
    };

    fetchLogs();
  }, [page, statusFilter, operationFilter, search, startDate, endDate]);

  const resetFilters = () => {
    setStatusFilter("");
    setOperationFilter("");
    setSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const uniqueOperationTypes = Array.from(new Set(logs.map((log) => log.operation_type)));

  return (
    <DashboardLayout title="Logs de Segurança" subtitle="Validações de URL, OAuth e operações sensíveis.">
      <div className="space-y-4">
        {/* Indicadores em tempo real da integração com o Mercado Livre */}
        <MercadoLivreStatusIndicators />

        <Card className="p-4 space-y-4">
          {/* Filtros avançados */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Período inicial</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Período final</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de operação</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value={operationFilter}
                onChange={(e) => {
                  setOperationFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                {uniqueOperationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                <option value="success">Sucesso</option>
                <option value="error">Erro</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[2fr,1fr] items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Busca por texto</label>
              <Input
                placeholder="Filtrar por mensagem de erro, entidade ou tipo..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Limpar filtros
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum log encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm bg-background"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                      {log.entity_type && (
                        <span className="text-xs text-muted-foreground">
                          {log.entity_type}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {log.operation_type}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  {log.error_message && (
                    <p className="text-xs text-destructive mt-1">{log.error_message}</p>
                  )}
                  {log.details && (
                    <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages} • {totalCount} registros
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((prev) => Math.max(1, prev - 1));
                    }}
                    aria-disabled={page === 1}
                  />
                </PaginationItem>
                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
                  if (pageNumber > 3 && pageNumber < totalPages && Math.abs(pageNumber - page) > 1) {
                    return null;
                  }
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === page}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((prev) => Math.min(totalPages, prev + 1));
                    }}
                    aria-disabled={page === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SecurityLogsPage;
