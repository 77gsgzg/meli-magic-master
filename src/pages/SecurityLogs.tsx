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
 type PublicationActionMapping = Tables<'publication_action_mappings'>;

const PAGE_SIZE = 20;

const OPERATION_TYPES: Tables<'operation_logs'>['operation_type'][] = [
  'import',
  'publish',
  'update',
  'delete',
  'token_refresh',
  'ai_optimization',
];

const SecurityLogsPage = () => {
  const location = useLocation();
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [mlLogs, setMlLogs] = useState<OperationLog[]>([]);
  const [publication, setPublication] = useState<PublicationHistory[]>([]);
  const [actionMappings, setActionMappings] = useState<PublicationActionMapping[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
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

    const loadUserAndMappings = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id ?? null;
      setUserId(currentUserId);

      if (!currentUserId) return;

      const { data: mappings } = await supabase
        .from("publication_action_mappings")
        .select("*")
        .eq("user_id", currentUserId);

      if (mappings) {
        setActionMappings(mappings as PublicationActionMapping[]);
      }
    };

    loadAlertSettings();
    loadUserAndMappings();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const save = async () => {
      await supabase.from("security_alert_settings").upsert({
        user_id: userId,
        error_threshold: alertThreshold,
        window_minutes: alertWindowMinutes,
      });
    };

    save();
  }, [alertThreshold, alertWindowMinutes, userId]);

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

  const distinctPublicationActions = useMemo(
    () =>
      Array.from(
        new Set(
          publication
            .map((p) => p.action)
            .filter((action): action is string => typeof action === "string" && action.length > 0),
        ),
      ),
    [publication],
  );

  const getOperationLabel = (type: string | null) => {
    if (!type) return "";
    const mappingWithDescription = actionMappings.find(
      (m) => m.operation_type === type && m.description && m.description.length > 0,
    );
    return mappingWithDescription ? `${type} — ${mappingWithDescription.description}` : type;
  };

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

  const handleSelectTimelinePoint = (params: {
    timestamp: string;
    type: "publication_error" | "integration_error";
    label: string;
    operationType?: string | null;
  }) => {
    const day = params.timestamp.slice(0, 10);
    setStartDate(day);
    setEndDate(day);
    setStatusFilter("error");

    if (params.type === "publication_error") {
      const mapped = actionMappings.find((m) => m.action === params.operationType);
      setOperationFilter(mapped?.operation_type ?? "");
    } else if (params.operationType) {
      setOperationFilter(params.operationType);
    } else {
      setOperationFilter("");
    }

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
        <IncidentTimeline
          publication={publication}
          logs={mlLogs}
          mappings={actionMappings}
          onSelectPoint={handleSelectTimelinePoint}
        />

        {/* Mapeamento de ações de publicação para tipos de operação */}
        <Card className="p-4 space-y-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Mapeamento de ações de publicação → tipos de operação em logs
            </p>
            <p className="text-[11px] text-muted-foreground max-w-xl">
              Use este mapeamento para dizer qual tipo de operação nos logs corresponde a cada
              <code className="px-1 rounded bg-muted text-[10px] ml-1 mr-1">publication_history.action</code>
              . Isso é usado no drill-down da linha do tempo e nos filtros.
            </p>
          </div>

          {distinctPublicationActions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma ação de publicação encontrada nos últimos registros.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {distinctPublicationActions.map((action) => {
                const currentMapping = actionMappings.find((m) => m.action === action);
                const value = currentMapping?.operation_type ?? "";
                const descriptionValue = currentMapping?.description ?? "";

                const handleOperationChange = async (newValue: string) => {
                  if (!userId || !newValue) return;

                  setActionMappings((prev) => {
                    const existing = prev.find((m) => m.action === action);
                    if (existing) {
                      return prev.map((m) =>
                        m.action === action ? { ...m, operation_type: newValue } : m,
                      );
                    }
                    const nowIso = new Date().toISOString();
                    return [
                      ...prev,
                      {
                        user_id: userId,
                        action,
                        operation_type: newValue,
                        description: "",
                        created_at: nowIso,
                        updated_at: nowIso,
                      } as PublicationActionMapping,
                    ];
                  });

                  await supabase.from("publication_action_mappings").upsert({
                    user_id: userId,
                    action,
                    operation_type: newValue,
                  });
                };

                const handleDescriptionBlur = async (newDescription: string) => {
                  if (!userId || !value) return;

                  setActionMappings((prev) => {
                    const existing = prev.find((m) => m.action === action);
                    if (existing) {
                      return prev.map((m) =>
                        m.action === action ? { ...m, description: newDescription } : m,
                      );
                    }
                    const nowIso = new Date().toISOString();
                    return [
                      ...prev,
                      {
                        user_id: userId,
                        action,
                        operation_type: value,
                        description: newDescription,
                        created_at: nowIso,
                        updated_at: nowIso,
                      } as PublicationActionMapping,
                    ];
                  });

                  await supabase.from("publication_action_mappings").upsert({
                    user_id: userId,
                    action,
                    operation_type: value,
                    description: newDescription || null,
                  });
                };

                return (
                  <div
                    key={action}
                    className="flex flex-col gap-2 border border-border rounded-md p-2 bg-background md:flex-row md:items-center md:justify-between"
                  >
                    <div className="text-[11px] text-muted-foreground break-all mr-3">
                      <span className="font-mono text-[11px]">{action}</span>
                    </div>
                    <div className="flex flex-col gap-1 w-full md:w-auto md:flex-row md:items-center md:justify-end">
                      <div className="flex-1 md:flex-none">
                        <label className="sr-only">Tipo de operação para {action}</label>
                        <select
                          className="h-8 w-full md:w-44 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                          value={value}
                          onChange={(e) => handleOperationChange(e.target.value)}
                        >
                          <option value="" disabled>
                            Tipo de operação correspondente
                          </option>
                          {OPERATION_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {getOperationLabel(type)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 md:flex-none">
                        <Input
                          className="h-8 text-xs"
                          placeholder="Descrição legível (ex: Publicar anúncio)"
                          defaultValue={descriptionValue}
                          onBlur={(e) => handleDescriptionBlur(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

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
