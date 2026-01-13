import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useRequireAuth } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, AlertCircle, ShoppingBag, Search, Filter, CalendarIcon, X, Download, ChevronLeft, ChevronRight, RefreshCw, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PublicationStatsCharts } from "@/components/diagnostics/PublicationStatsCharts";
import { useMercadoLivre } from "@/hooks/useMercadoLivre";
import { toast } from "sonner";

interface PublicationLog {
  id: string;
  created_at: string;
  action: string;
  status: string;
  error_details: string | null;
  product_id: string;
}

interface ProductSummary {
  id: string;
  title: string;
  category_id: string | null;
  price: number | null;
  description: string | null;
  images: unknown;
  available_quantity: number | null;
  condition: string | null;
  listing_type: string | null;
  currency: string | null;
  attributes: unknown;
}

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

const ITEMS_PER_PAGE = 20;

export default function PublicationDiagnostics() {
  const { user, loading: authLoading } = useRequireAuth();
  const { session } = useAuth();
  const { callMLApi, connection } = useMercadoLivre();
  const [logs, setLogs] = useState<PublicationLog[]>([]);
  const [products, setProducts] = useState<Record<string, ProductSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const { data: logData, error: logError } = await supabase
          .from("publication_history")
          .select("id, created_at, action, status, error_details, product_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500);

        if (logError) {
          setError("Erro ao carregar logs de publicação");
          return;
        }

        setLogs(logData || []);

        const productIds = Array.from(new Set((logData || []).map((l) => l.product_id)));
        if (productIds.length) {
          const { data: productData } = await supabase
            .from("products")
            .select("id, title, category_id, price, description, images, available_quantity, condition, listing_type, currency, attributes")
            .in("id", productIds);

          const map: Record<string, ProductSummary> = {};
          (productData || []).forEach((p) => {
            map[p.id] = p as ProductSummary;
          });
          setProducts(map);
        }
      } catch (err) {
        setError("Erro inesperado ao carregar diagnóstico de publicações");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  // Extract unique actions and statuses for filter options
  const uniqueActions = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.action)));
  }, [logs]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.status)));
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const product = products[log.product_id];
      const productTitle = product?.title || "";

      // Search term filter
      const matchesSearch =
        searchTerm === "" ||
        productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.error_details && log.error_details.toLowerCase().includes(searchTerm.toLowerCase()));

      // Status filter
      const matchesStatus = statusFilter === "all" || log.status === statusFilter;

      // Action filter
      const matchesAction = actionFilter === "all" || log.action === actionFilter;

      // Date range filter
      const logDate = new Date(log.created_at);
      const matchesDateFrom = !dateRange.from || logDate >= dateRange.from;
      const matchesDateTo = !dateRange.to || logDate <= new Date(dateRange.to.getTime() + 86400000);

      return matchesSearch && matchesStatus && matchesAction && matchesDateFrom && matchesDateTo;
    });
  }, [logs, products, searchTerm, statusFilter, actionFilter, dateRange]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, actionFilter, dateRange]);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setActionFilter("all");
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters =
    searchTerm !== "" || statusFilter !== "all" || actionFilter !== "all" || dateRange.from || dateRange.to;

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Data/Hora", "Produto", "Ação", "Status", "Erro"];
    const rows = filteredLogs.map((log) => {
      const product = products[log.product_id];
      return [
        new Date(log.created_at).toLocaleString("pt-BR"),
        product?.title || log.product_id,
        log.action,
        log.status,
        log.error_details || "",
      ];
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `diagnostico-publicacoes-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Retry publication for a failed product
  const retryPublication = async (productId: string) => {
    const product = products[productId];
    if (!product) {
      toast.error("Produto não encontrado");
      return;
    }

    if (!connection.connected) {
      toast.error("Mercado Livre não conectado. Vá até a página de conexão primeiro.");
      return;
    }

    setRetryingIds((prev) => new Set(prev).add(productId));

    try {
      const images = Array.isArray(product.images) 
        ? (product.images as string[])
        : [];
      
      const attributes = Array.isArray(product.attributes)
        ? product.attributes
        : [];

      const result = await callMLApi("publish_item", {
        product_id: productId,
        title: product.title,
        category_id: product.category_id,
        price: product.price,
        description: product.description,
        images,
        available_quantity: product.available_quantity || 1,
        condition: product.condition || "new",
        listing_type: product.listing_type || "gold_special",
        currency: product.currency || "BRL",
        attributes,
      });

      if (result.id) {
        toast.success("Produto republicado com sucesso!");
        // Reload logs
        const { data: logData } = await supabase
          .from("publication_history")
          .select("id, created_at, action, status, error_details, product_id")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(500);
        if (logData) {
          setLogs(logData);
        }
      } else {
        toast.error(result.message || "Erro ao republicar produto");
      }
    } catch (err) {
      console.error("Retry error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao republicar produto");
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout
        title="Diagnóstico de Publicações"
        subtitle="Status e erros recentes de publicação no Mercado Livre"
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Diagnóstico de Publicações"
      subtitle="Use esta página para entender por que anúncios falharam ou ficaram em erro"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Stats Charts Section */}
        <PublicationStatsCharts logs={logs} />

        {/* Filters Section */}
        <Card variant="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4 text-primary" />
                Filtros
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={filteredLogs.length === 0}
                className="h-8"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto, ação, erro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Action Filter */}
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Range Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM", { locale: ptBR })} -{" "}
                          {format(dateRange.to, "dd/MM", { locale: ptBR })}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                      )
                    ) : (
                      "Período"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                    locale={ptBR}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  {filteredLogs.length} de {logs.length} registros
                </span>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Limpar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs List */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Últimas tentativas de publicação
            </CardTitle>
            <CardDescription>
              Lista consolidada das últimas ações de publicação, atualização ou remoção de anúncios
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive mb-4">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {filteredLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {logs.length === 0
                  ? "Nenhuma publicação registrada ainda. Importe um produto e tente publicar para ver os logs aqui."
                  : "Nenhum registro encontrado com os filtros aplicados."}
              </p>
            ) : (
              <>
                <div className="space-y-2 text-xs font-mono">
                  {paginatedLogs.map((log) => {
                    const product = products[log.product_id];
                    const isError = log.status !== "success";

                    return (
                      <div
                        key={log.id}
                        className="rounded-md border border-border/60 bg-muted/40 p-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(log.created_at).toLocaleString("pt-BR")}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.action}</Badge>
                            <Badge variant={isError ? "destructive" : "success"}>
                              {log.status}
                            </Badge>
                            {isError && log.action === "publish" && product && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => retryPublication(log.product_id)}
                                disabled={retryingIds.has(log.product_id) || !connection.connected}
                                title={!connection.connected ? "Conecte ao Mercado Livre primeiro" : "Re-tentar publicação"}
                              >
                                {retryingIds.has(log.product_id) ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Retry
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-1 text-[11px] text-muted-foreground">
                          <ShoppingBag className="h-3 w-3" />
                          <span className="truncate max-w-xs">
                            {product?.title || `Produto ${log.product_id}`}
                          </span>
                        </div>

                        {log.error_details && (
                          <pre className="mt-1 text-[10px] leading-snug overflow-x-auto whitespace-pre-wrap break-all text-destructive/80">
                            {log.error_details}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8"
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
