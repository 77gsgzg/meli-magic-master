import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  History,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  exportPriceHistoryToCSV,
  exportPriceHistoryToExcel,
} from "@/utils/exportSupplierPriceHistory";

interface PriceHistoryEntry {
  id: string;
  supplier_product_id: string;
  old_price: number;
  new_price: number;
  price_change_percent: number;
  detected_at: string;
  alert_sent: boolean;
}

interface SupplierProduct {
  id: string;
  title: string;
  supplier_name: string;
  price: number | null;
}

interface SupplierPriceHistoryChartProps {
  userId: string;
}

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  price: number;
  changePercent?: number;
}

export function SupplierPriceHistoryChart({ userId }: SupplierPriceHistoryChartProps) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId, timeRange]);

  const loadData = async () => {
    try {
      const daysAgo = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const startDate = subDays(new Date(), daysAgo).toISOString();

      // Load price history
      const { data: historyData, error: historyError } = await supabase
        .from("supplier_price_history")
        .select("*")
        .eq("user_id", userId)
        .gte("detected_at", startDate)
        .order("detected_at", { ascending: true });

      if (historyError) throw historyError;

      // Load supplier products for filter
      const { data: productsData, error: productsError } = await supabase
        .from("supplier_products")
        .select("id, title, supplier_name, price")
        .eq("user_id", userId)
        .order("title");

      if (productsError) throw productsError;

      setHistory(historyData || []);
      setProducts(productsData || []);
    } catch (error) {
      console.error("Error loading price history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const prepareExportData = () => {
    return filteredHistory.map((entry) => {
      const product = products.find((p) => p.id === entry.supplier_product_id);
      return {
        ...entry,
        productTitle: product?.title || "Produto desconhecido",
        supplierName: product?.supplier_name || "Fornecedor desconhecido",
      };
    });
  };

  const handleExportCSV = () => {
    const data = prepareExportData();
    exportPriceHistoryToCSV({ data, format: "csv" });
    toast.success("CSV exportado com sucesso!");
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    exportPriceHistoryToExcel({ data, format: "excel" });
    toast.success("Excel exportado com sucesso!");
  };

  const filteredHistory = selectedProductId === "all"
    ? history
    : history.filter(h => h.supplier_product_id === selectedProductId);

  // Prepare chart data - group by date and product
  const prepareChartData = (): ChartDataPoint[] => {
    if (filteredHistory.length === 0) return [];

    const dataByDate = new Map<string, { prices: number[]; changes: number[] }>();

    filteredHistory.forEach(entry => {
      const dateKey = format(parseISO(entry.detected_at), "yyyy-MM-dd");
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, { prices: [], changes: [] });
      }
      const data = dataByDate.get(dateKey)!;
      data.prices.push(entry.new_price);
      data.changes.push(entry.price_change_percent);
    });

    const chartData: ChartDataPoint[] = [];
    dataByDate.forEach((value, date) => {
      const avgPrice = value.prices.reduce((a, b) => a + b, 0) / value.prices.length;
      const avgChange = value.changes.reduce((a, b) => a + b, 0) / value.changes.length;
      chartData.push({
        date,
        dateLabel: format(parseISO(date), "dd/MM", { locale: ptBR }),
        price: Math.round(avgPrice * 100) / 100,
        changePercent: Math.round(avgChange * 100) / 100,
      });
    });

    return chartData.sort((a, b) => a.date.localeCompare(b.date));
  };

  const chartData = prepareChartData();

  // Calculate summary stats
  const totalChanges = filteredHistory.length;
  const priceIncreases = filteredHistory.filter(h => h.price_change_percent > 0).length;
  const priceDecreases = filteredHistory.filter(h => h.price_change_percent < 0).length;
  const avgChangePercent = filteredHistory.length > 0
    ? filteredHistory.reduce((sum, h) => sum + h.price_change_percent, 0) / filteredHistory.length
    : 0;

  const selectedProduct = selectedProductId !== "all"
    ? products.find(p => p.id === selectedProductId)
    : null;

  if (loading) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de Preços do Fornecedor
            </CardTitle>
            <CardDescription>
              Acompanhe a evolução dos preços dos fornecedores ao longo do tempo
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os produtos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.title.substring(0, 30)}...
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as "7d" | "30d" | "90d")}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportCSV} disabled={filteredHistory.length === 0}>
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} disabled={filteredHistory.length === 0}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{totalChanges}</p>
            <p className="text-sm text-muted-foreground">Alterações</p>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-500">
              <TrendingUp className="h-5 w-5" />
              <span className="text-2xl font-bold">{priceIncreases}</span>
            </div>
            <p className="text-sm text-muted-foreground">Aumentos</p>
          </div>
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-red-500">
              <TrendingDown className="h-5 w-5" />
              <span className="text-2xl font-bold">{priceDecreases}</span>
            </div>
            <p className="text-sm text-muted-foreground">Reduções</p>
          </div>
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className={`flex items-center gap-2 ${avgChangePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {avgChangePercent >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              <span className="text-2xl font-bold">{avgChangePercent.toFixed(1)}%</span>
            </div>
            <p className="text-sm text-muted-foreground">Variação Média</p>
          </div>
        </div>

        {selectedProduct && (
          <div className="mb-4 p-3 rounded-lg bg-muted/30 flex items-center gap-3">
            <Badge variant="outline">{selectedProduct.supplier_name}</Badge>
            <span className="text-sm font-medium">{selectedProduct.title}</span>
            {selectedProduct.price && (
              <span className="text-sm text-muted-foreground ml-auto">
                Preço atual: R$ {selectedProduct.price.toFixed(2)}
              </span>
            )}
          </div>
        )}

        {chartData.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mb-4" />
            <p>Nenhum histórico de preços encontrado</p>
            <p className="text-sm">Execute o re-scraping para detectar alterações de preço</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Price Trend Chart */}
            <div>
              <h4 className="text-sm font-medium mb-3">Tendência de Preços</h4>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="dateLabel" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `R$ ${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Preço"]}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    fill="url(#priceGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Price Change Percent Chart */}
            <div>
              <h4 className="text-sm font-medium mb-3">Variação Percentual</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="dateLabel" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, "Variação"]}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="changePercent"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2 }}
                  />
                  {/* Zero line */}
                  <Line
                    type="monotone"
                    dataKey={() => 0}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent Changes List */}
        {filteredHistory.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3">Últimas Alterações</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {filteredHistory.slice(-10).reverse().map(entry => {
                const product = products.find(p => p.id === entry.supplier_product_id);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {product?.title || "Produto desconhecido"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(entry.detected_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground line-through">
                          R$ {entry.old_price.toFixed(2)}
                        </p>
                        <p className="text-sm font-medium">
                          R$ {entry.new_price.toFixed(2)}
                        </p>
                      </div>
                      <Badge
                        variant={entry.price_change_percent > 0 ? "destructive" : "default"}
                        className={entry.price_change_percent < 0 ? "bg-green-500" : ""}
                      >
                        {entry.price_change_percent > 0 ? "+" : ""}
                        {entry.price_change_percent.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
