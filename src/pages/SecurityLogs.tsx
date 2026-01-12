import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { MercadoLivreStatusIndicators } from "@/components/dashboard/MercadoLivreStatusIndicators";
import { SecurityLogsCharts } from "@/components/security/SecurityLogsCharts";
import { AggregatedIncidents } from "@/components/security/AggregatedIncidents";
import { MercadoLivrePanel } from "@/components/security/MercadoLivrePanel";
import { IncidentTimeline } from "@/components/security/IncidentTimeline";
import { Tables } from "@/integrations/supabase/types";

 type OperationLog = Tables<'operation_logs'>;
 type PublicationHistory = Tables<'publication_history'>;

const PAGE_SIZE = 20;

const SecurityLogsPage = () => {
  const location = useLocation();
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [mlLogs, setMlLogs] = useState<OperationLog[]>([]);
  const [publication, setPublication] = useState<PublicationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [operationFilter, setOperationFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [alertThreshold, setAlertThreshold] = useState<number>(10);
  const [alertWindowMinutes, setAlertWindowMinutes] = useState<number>(15);
  const [chartMode, setChartMode] = useState<"errors" | "all">("errors");
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d" | "custom">("7d");

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get("status");
    if (status) {
      setStatusFilter(status);
      setPage(1);
    }
  }, [location.search]);

  useEffect(() => {
    const loadAlertSettings = async () => {
      const { data } = await supabase
        .from("security_alert_settings")
        .select("error_threshold, window_minutes")
        .maybeSingle();
      if (data) {
        setAlertThreshold(data.error_threshold ?? 10);
        setAlertWindowMinutes(data.window_minutes ?? 15);
      }
    };
    loadAlertSettings();
  }, []);

  useEffect(() => {
    const save = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      await supabase.from("security_alert_settings").upsert({
        user_id: userId,
        error_threshold: alertThreshold,
        window_minutes: alertWindowMinutes,
      });
    };
    save();
  }, [alertThreshold, alertWindowMinutes]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      let query = supabase
        .from("operation_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      if (operationFilter) {
        query = query.eq("operation_type", operationFilter as any);
      }

      if (startDate) {
        query = query.gte("created_at", new Date(startDate).toISOString());
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      if (search) {
        const like = `%${search}%`;
        query = query.or(
          `error_message.ilike.${like},entity_id.ilike.${like},entity_type.ilike.${like}`,
        );
      }

      const [logsRes, mlLogsRes, pubRes] = await Promise.all([
        query,
        supabase
          .from("operation_logs")
          .select("*")
          .eq("entity_type", "mercado_livre")
          .order("created_at", { ascending: true }),
        supabase
          .from("publication_history")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(500),
      ]);

      if (!logsRes.error && logsRes.data) {
        setLogs(logsRes.data as OperationLog[]);
        setTotalCount(logsRes.count ?? 0);
      }
      if (!mlLogsRes.error && mlLogsRes.data) {
        setMlLogs(mlLogsRes.data as OperationLog[]);
      }
      if (!pubRes.error && pubRes.data) {
        setPublication(pubRes.data as PublicationHistory[]);
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

  const uniqueOperationTypes = useMemo(
    () => Array.from(new Set(logs.map((log) => log.operation_type))),
    [logs],
  );

  const now = new Date();
  const cutoff = new Date(now.getTime() - alertWindowMinutes * 60 * 1000);
  const recentErrors = logs.filter(
    (log) =>
      log.status === "error" &&
      log.created_at &&
      new Date(log.created_at) >= cutoff,
  ).length;

  const handleExportCsv = () => {
    if (logs.length === 0) return;

    const header = [
      "created_at",
      "status",
      "operation_type",
      "entity_type",
      "entity_id",
      "duration_ms",
      "error_message",
    ];

    const rows = logs.map((log) => [
      log.created_at,
      log.status,
      log.operation_type,
      log.entity_type ?? "",
      log.entity_id ?? "",
      log.duration_ms?.toString() ?? "",
      (log.error_message ?? "").replace(/\s+/g, " ").trim(),
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `security-logs-${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const applyPeriodPreset = (preset: "7d" | "30d" | "custom") => {
    setChartPeriod(preset);
    if (preset === "custom") return;
    const days = preset === "7d" ? 7 : 30;
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(now.toISOString().slice(0, 10));
    setPage(1);
  };

  const handleSelectIncident = (params: { entityId: string; start: string; end: string }) => {
    setSearch(params.entityId);
    setStartDate(params.start.slice(0, 10));
    setEndDate(params.end.slice(0, 10));
    setPage(1);
  };

  return (
    <DashboardLayout
      title="Logs de Segurança"
      subtitle="Validações de URL, OAuth e operações sensíveis."
    >
      <div className="space-y-4">
        {/* Indicadores em tempo real da integração com o Mercado Livre */}
        <MercadoLivreStatusIndicators />

        {/* Controles de modo/período dos gráficos + gráficos de tendência */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Modo dos gráficos:</span>
              <Button
                type="button"
                size="sm"
                variant={chartMode === "errors" ? "default" : "outline"}
                className="h-7 px-2"
                onClick={() => setChartMode("errors")}
              >
                Somente erros
              </Button>
              <Button
                type="button"
                size="sm"
                variant={chartMode === "all" ? "default" : "outline"}
                className="h-7 px-2"
                onClick={() => setChartMode("all")}
              >
                Todas as operações
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Período rápido:</span>
              <Button
                type="button"
                size="sm"
                variant={chartPeriod === "7d" ? "default" : "outline"}
                className="h-7 px-2"
                onClick={() => applyPeriodPreset("7d")}
              >
                Últimos 7 dias
              </Button>
              <Button
                type="button"
                size="sm"
                variant={chartPeriod === "30d" ? "default" : "outline"}
                className="h-7 px-2"
                onClick={() => applyPeriodPreset("30d")}
              >
                Últimos 30 dias
              </Button>
              <Button
                type="button"
                size="sm"
                variant={chartPeriod === "custom" ? "default" : "outline"}
                className="h-7 px-2"
                onClick={() => setChartPeriod("custom")}
              >
                Personalizado
              </Button>
            </div>
          </div>
          <SecurityLogsCharts logs={logs} mode={chartMode} period={chartPeriod} />
        </div>

        {/* Painel dedicado da integração Mercado Livre */}
        <MercadoLivrePanel />

        {/* Linha do tempo de incidentes críticos Mercado Livre */}
        <IncidentTimeline publication={publication} logs={mlLogs} />

        {/* Configurações de alerta e filtros */}
        <Card className="p-4 space-y-4">
          {/* Alertas configuráveis */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Alertas de degradação (preferências salvas por usuário)
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Disparar alerta quando houver mais de</span>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-16"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(Number(e.target.value) || 1)}
                  />
                  <span>erros nos últimos</span>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-16"
                    value={alertWindowMinutes}
                    onChange={(e) => setAlertWindowMinutes(Number(e.target.value) || 1)}
                  />
                  <span>minutos.</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                Exportar CSV (logs filtrados)
              </Button>
            </div>
          </div>

          {recentErrors >= alertThreshold && (
            <div className="mt-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Alerta: {recentErrors} erros registrados nos últimos {alertWindowMinutes} minutos com os filtros atuais.
            </div>
          )}

          {/* Filtros avançados */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 items-end mt-4">
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

        {/* Incidentes agregados com base nos filtros atuais */}
        <AggregatedIncidents logs={logs} onSelectIncident={handleSelectIncident} />

        {/* Lista de logs + paginação */}
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
                      <Badge variant={log.status === "success" ? "default" : "destructive"}>
                        {log.status}
                      </Badge>
                      {log.entity_type && (
                        <span className="text-xs text-muted-foreground">{log.entity_type}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{log.operation_type}</span>
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
