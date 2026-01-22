import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Scale,
} from "lucide-react";

interface SupplierProduct {
  id: string;
  title: string;
  supplier_name: string;
  price: number | null;
  target_price: number | null;
  margin: number | null;
}

interface GroupedProduct {
  baseTitle: string;
  products: SupplierProduct[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  priceSpread: number;
}

interface SupplierPriceComparisonProps {
  userId: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function SupplierPriceComparison({ userId }: SupplierPriceComparisonProps) {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [userId]);

  useEffect(() => {
    groupProducts();
  }, [products, searchTerm]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("supplier_products")
        .select("id, title, supplier_name, price, target_price, margin")
        .eq("user_id", userId)
        .not("price", "is", null)
        .order("title");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  // Normalize title to group similar products
  const normalizeTitle = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 4) // Use first 4 words as base
      .join(" ");
  };

  const groupProducts = () => {
    const filtered = searchTerm
      ? products.filter(
          (p) =>
            p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : products;

    const groups = new Map<string, SupplierProduct[]>();

    filtered.forEach((product) => {
      const baseTitle = normalizeTitle(product.title);
      if (!groups.has(baseTitle)) {
        groups.set(baseTitle, []);
      }
      groups.get(baseTitle)!.push(product);
    });

    // Only keep groups with multiple suppliers
    const multiSupplierGroups: GroupedProduct[] = [];

    groups.forEach((productList, baseTitle) => {
      // Check for unique suppliers
      const uniqueSuppliers = new Set(productList.map((p) => p.supplier_name));
      
      if (uniqueSuppliers.size > 1 || productList.length > 1) {
        const prices = productList
          .filter((p) => p.price !== null)
          .map((p) => p.price!);

        if (prices.length > 0) {
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

          multiSupplierGroups.push({
            baseTitle,
            products: productList.sort((a, b) => (a.price || 0) - (b.price || 0)),
            minPrice,
            maxPrice,
            avgPrice,
            priceSpread: ((maxPrice - minPrice) / minPrice) * 100,
          });
        }
      }
    });

    // Sort by price spread (biggest difference first)
    multiSupplierGroups.sort((a, b) => b.priceSpread - a.priceSpread);
    setGroupedProducts(multiSupplierGroups);
  };

  // Get chart data for a specific group
  const getChartData = (group: GroupedProduct) => {
    return group.products.map((p) => ({
      name: p.supplier_name.substring(0, 15) + (p.supplier_name.length > 15 ? "..." : ""),
      price: p.price || 0,
      fullName: p.supplier_name,
      productId: p.id,
    }));
  };

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
              <Scale className="h-5 w-5 text-primary" />
              Comparativo de Preços por Fornecedor
            </CardTitle>
            <CardDescription>
              Compare preços do mesmo produto entre diferentes fornecedores
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
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
            <p className="text-2xl font-bold">{products.length}</p>
            <p className="text-sm text-muted-foreground">Produtos</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">
              {new Set(products.map((p) => p.supplier_name)).size}
            </p>
            <p className="text-sm text-muted-foreground">Fornecedores</p>
          </div>
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-2xl font-bold text-primary">{groupedProducts.length}</p>
            <p className="text-sm text-muted-foreground">Comparáveis</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">
              {groupedProducts.length > 0
                ? `${groupedProducts[0].priceSpread.toFixed(0)}%`
                : "0%"}
            </p>
            <p className="text-sm text-muted-foreground">Maior Diferença</p>
          </div>
        </div>

        {groupedProducts.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
            <Scale className="h-12 w-12 mb-4" />
            <p>Nenhum produto comparável encontrado</p>
            <p className="text-sm">
              Adicione produtos de diferentes fornecedores com nomes similares
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedProducts.slice(0, 5).map((group, groupIndex) => (
              <div
                key={group.baseTitle}
                className="p-4 rounded-lg bg-muted/30 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-medium capitalize">{group.baseTitle}</h4>
                    <p className="text-sm text-muted-foreground">
                      {group.products.length} fornecedores
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="gap-1">
                      <TrendingDown className="h-3 w-3 text-green-500" />
                      R$ {group.minPrice.toFixed(2)}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Minus className="h-3 w-3" />
                      R$ {group.avgPrice.toFixed(2)}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <TrendingUp className="h-3 w-3 text-red-500" />
                      R$ {group.maxPrice.toFixed(2)}
                    </Badge>
                    <Badge
                      variant={group.priceSpread > 20 ? "destructive" : "secondary"}
                    >
                      Δ {group.priceSpread.toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={getChartData(group)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      type="number"
                      className="text-xs fill-muted-foreground"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      className="text-xs fill-muted-foreground"
                      tick={{ fontSize: 11 }}
                      width={100}
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
                      {getChartData(group).map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Best option recommendation */}
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="bg-green-500">Melhor Preço</Badge>
                  <span>
                    {group.products[0].supplier_name}: R$ {group.products[0].price?.toFixed(2)}
                  </span>
                  {group.products.length > 1 && (
                    <span className="text-muted-foreground">
                      (economia de R${" "}
                      {((group.products[group.products.length - 1].price || 0) -
                        (group.products[0].price || 0)).toFixed(2)}{" "}
                      vs mais caro)
                    </span>
                  )}
                </div>
              </div>
            ))}

            {groupedProducts.length > 5 && (
              <p className="text-center text-sm text-muted-foreground">
                +{groupedProducts.length - 5} produtos comparáveis
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
