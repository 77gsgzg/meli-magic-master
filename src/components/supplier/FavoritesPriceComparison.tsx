import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Star,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface FavoriteSupplier {
  id: string;
  name: string;
  is_favorite: boolean;
}

interface SupplierProduct {
  id: string;
  title: string;
  supplier_name: string;
  price: number | null;
  updated_at: string;
}

interface PriceComparison {
  productTitle: string;
  normalizedTitle: string;
  suppliers: {
    name: string;
    price: number;
    productId: string;
  }[];
  minPrice: number;
  maxPrice: number;
  priceSpread: number;
  savingsAmount: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function FavoritesPriceComparison() {
  const { session } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteSupplier[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<"spread" | "savings">("spread");

  useEffect(() => {
    if (session?.user?.id) {
      loadData();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (products.length > 0 && favorites.length > 0) {
      computeComparisons();
    }
  }, [products, favorites, searchTerm, sortBy]);

  const loadData = async () => {
    try {
      // Load favorite suppliers
      const { data: favData, error: favError } = await supabase
        .from("discovered_suppliers")
        .select("id, name, is_favorite")
        .eq("is_favorite", true);

      if (favError) throw favError;
      setFavorites(favData || []);

      const favoriteNames = (favData || []).map(f => f.name);

      if (favoriteNames.length === 0) {
        setProducts([]);
        setComparisons([]);
        setLoading(false);
        return;
      }

      // Load products from favorite suppliers
      const { data: prodData, error: prodError } = await supabase
        .from("supplier_products")
        .select("id, title, supplier_name, price, updated_at")
        .in("supplier_name", favoriteNames)
        .not("price", "is", null)
        .order("title");

      if (prodError) throw prodError;
      setProducts(prodData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const normalizeTitle = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 4)
      .join(" ");
  };

  const computeComparisons = () => {
    const filtered = searchTerm
      ? products.filter(p =>
          p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : products;

    const groups = new Map<string, SupplierProduct[]>();

    filtered.forEach(product => {
      const baseTitle = normalizeTitle(product.title);
      if (!groups.has(baseTitle)) {
        groups.set(baseTitle, []);
      }
      groups.get(baseTitle)!.push(product);
    });

    const result: PriceComparison[] = [];

    groups.forEach((productList, baseTitle) => {
      const uniqueSuppliers = new Set(productList.map(p => p.supplier_name));

      if (uniqueSuppliers.size > 1) {
        const suppliers = productList
          .filter(p => p.price !== null)
          .map(p => ({
            name: p.supplier_name,
            price: p.price!,
            productId: p.id,
          }))
          .sort((a, b) => a.price - b.price);

        if (suppliers.length > 1) {
          const minPrice = suppliers[0].price;
          const maxPrice = suppliers[suppliers.length - 1].price;
          const priceSpread = ((maxPrice - minPrice) / minPrice) * 100;
          const savingsAmount = maxPrice - minPrice;

          result.push({
            productTitle: productList[0].title,
            normalizedTitle: baseTitle,
            suppliers,
            minPrice,
            maxPrice,
            priceSpread,
            savingsAmount,
          });
        }
      }
    });

    // Sort by selected criteria
    result.sort((a, b) =>
      sortBy === "spread"
        ? b.priceSpread - a.priceSpread
        : b.savingsAmount - a.savingsAmount
    );

    setComparisons(result);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalPotentialSavings = useMemo(() => {
    return comparisons.reduce((sum, c) => sum + c.savingsAmount, 0);
  }, [comparisons]);

  const averageSpread = useMemo(() => {
    if (comparisons.length === 0) return 0;
    return comparisons.reduce((sum, c) => sum + c.priceSpread, 0) / comparisons.length;
  }, [comparisons]);

  const getChartData = (comparison: PriceComparison) => {
    return comparison.suppliers.map(s => ({
      name: s.name.substring(0, 12) + (s.name.length > 12 ? "..." : ""),
      price: s.price,
      fullName: s.name,
    }));
  };

  if (loading) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (favorites.length === 0) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum fornecedor favorito</p>
            <p className="text-sm mt-1">
              Marque fornecedores como favoritos para comparar preços
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="glass border-border/50">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                Comparativo de Preços - Favoritos
              </CardTitle>
              <CardDescription>
                Compare preços do mesmo produto entre seus fornecedores favoritos
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy(sortBy === "spread" ? "savings" : "spread")}
                className="gap-1"
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortBy === "spread" ? "% Spread" : "R$ Economia"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{favorites.length}</p>
              <p className="text-sm text-muted-foreground">Fornecedores Favoritos</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{products.length}</p>
              <p className="text-sm text-muted-foreground">Produtos Monitorados</p>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-2xl font-bold text-primary">{comparisons.length}</p>
              <p className="text-sm text-muted-foreground">Comparáveis</p>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-2xl font-bold text-green-600">
                R$ {totalPotentialSavings.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Economia Potencial</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparisons */}
      {comparisons.length === 0 ? (
        <Card className="glass border-border/50">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum produto comparável</p>
              <p className="text-sm mt-1">
                Importe produtos dos fornecedores favoritos para comparar preços
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-4 pr-4">
            {comparisons.map((comparison, index) => (
              <Card key={comparison.normalizedTitle} className="glass border-border/50">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-medium capitalize line-clamp-1">
                        {comparison.productTitle}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {comparison.suppliers.length} fornecedores favoritos
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="gap-1">
                        <TrendingDown className="h-3 w-3 text-green-500" />
                        R$ {comparison.minPrice.toFixed(2)}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <TrendingUp className="h-3 w-3 text-red-500" />
                        R$ {comparison.maxPrice.toFixed(2)}
                      </Badge>
                      <Badge
                        variant={comparison.priceSpread > 15 ? "destructive" : "secondary"}
                      >
                        Δ {comparison.priceSpread.toFixed(1)}%
                      </Badge>
                      <Badge className="bg-green-500">
                        Economia: R$ {comparison.savingsAmount.toFixed(2)}
                      </Badge>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={getChartData(comparison)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        type="number"
                        className="text-xs fill-muted-foreground"
                        tick={{ fontSize: 11 }}
                        tickFormatter={value => `R$ ${value}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        className="text-xs fill-muted-foreground"
                        tick={{ fontSize: 10 }}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Preço"]}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullName || ""
                        }
                      />
                      <Bar dataKey="price" radius={[0, 4, 4, 0]}>
                        {getChartData(comparison).map((_, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={i === 0 ? "hsl(var(--chart-2))" : COLORS[i % COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="flex items-center gap-2 text-sm border-t pt-3">
                    <Badge className="bg-green-500">Melhor Preço</Badge>
                    <span className="font-medium">
                      {comparison.suppliers[0].name}: R$ {comparison.suppliers[0].price.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
