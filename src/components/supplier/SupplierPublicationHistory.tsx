import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Package,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PublicationRecord {
  id: string;
  supplier_name: string;
  title: string;
  optimized_title: string | null;
  price: number | null;
  target_price: number | null;
  margin: number | null;
  is_published: boolean;
  ml_item_id: string | null;
  published_product_id: string | null;
  created_at: string;
  updated_at: string;
  product_status?: string;
  product_ml_permalink?: string | null;
}

interface SupplierPublicationHistoryProps {
  userId: string;
}

export function SupplierPublicationHistory({ userId }: SupplierPublicationHistoryProps) {
  const [records, setRecords] = useState<PublicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [userId]);

  const loadHistory = async () => {
    try {
      // Get supplier products that have been published or attempted
      const { data: supplierProducts, error: spError } = await supabase
        .from("supplier_products")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (spError) throw spError;

      // Get associated product statuses
      const publishedIds = supplierProducts
        ?.filter(p => p.published_product_id)
        .map(p => p.published_product_id) || [];

      let productStatuses: Record<string, { status: string; ml_permalink: string | null }> = {};
      
      if (publishedIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, status, ml_permalink")
          .in("id", publishedIds);

        if (products) {
          productStatuses = products.reduce((acc, p) => {
            acc[p.id] = { status: p.status, ml_permalink: p.ml_permalink };
            return acc;
          }, {} as Record<string, { status: string; ml_permalink: string | null }>);
        }
      }

      const enrichedRecords = supplierProducts?.map(sp => ({
        id: sp.id,
        supplier_name: sp.supplier_name,
        title: sp.title,
        optimized_title: sp.optimized_title,
        price: sp.price ? Number(sp.price) : null,
        target_price: sp.target_price ? Number(sp.target_price) : null,
        margin: sp.margin ? Number(sp.margin) : null,
        is_published: sp.is_published || false,
        ml_item_id: sp.ml_item_id,
        published_product_id: sp.published_product_id,
        created_at: sp.created_at,
        updated_at: sp.updated_at,
        product_status: sp.published_product_id ? productStatuses[sp.published_product_id]?.status : undefined,
        product_ml_permalink: sp.published_product_id ? productStatuses[sp.published_product_id]?.ml_permalink : null,
      })) || [];

      setRecords(enrichedRecords);
    } catch (error) {
      console.error("Error loading publication history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const getStatusBadge = (record: PublicationRecord) => {
    if (!record.is_published) {
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Pendente
        </Badge>
      );
    }

    if (record.product_status === "published") {
      return (
        <Badge className="bg-green-500 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Publicado
        </Badge>
      );
    }

    if (record.product_status === "error") {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Erro
        </Badge>
      );
    }

    if (record.product_status === "pending") {
      return (
        <Badge className="bg-yellow-500 gap-1">
          <Clock className="h-3 w-3" />
          Processando
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        {record.product_status || "Desconhecido"}
      </Badge>
    );
  };

  const calculateSalePrice = (record: PublicationRecord) => {
    if (record.target_price) return record.target_price;
    if (record.price && record.margin) {
      return record.price * (1 + record.margin / 100);
    }
    return record.price;
  };

  const publishedCount = records.filter(r => r.is_published && r.product_status === "published").length;
  const pendingCount = records.filter(r => !r.is_published).length;
  const errorCount = records.filter(r => r.product_status === "error").length;

  if (loading) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Histórico de Publicações
            </CardTitle>
            <CardDescription>
              Acompanhe o status de todos os produtos enviados ao Mercado Livre
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-2xl font-bold">{publishedCount}</span>
            </div>
            <p className="text-sm text-muted-foreground">Publicados</p>
          </div>
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 text-yellow-500">
              <Clock className="h-5 w-5" />
              <span className="text-2xl font-bold">{pendingCount}</span>
            </div>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </div>
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-red-500">
              <XCircle className="h-5 w-5" />
              <span className="text-2xl font-bold">{errorCount}</span>
            </div>
            <p className="text-sm text-muted-foreground">Com Erro</p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum produto publicado ainda</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Preço Custo</TableHead>
                  <TableHead className="text-right">Preço Venda</TableHead>
                  <TableHead className="text-center">Margem</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <p className="font-medium truncate">
                          {record.optimized_title || record.title}
                        </p>
                        {record.ml_item_id && (
                          <p className="text-xs text-muted-foreground">
                            ML: {record.ml_item_id}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.supplier_name}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {record.price ? `R$ ${record.price.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {calculateSalePrice(record) 
                        ? `R$ ${calculateSalePrice(record)!.toFixed(2)}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {record.margin ? (
                        <div className="flex items-center justify-center gap-1 text-green-500">
                          <TrendingUp className="h-3 w-3" />
                          {record.margin}%
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(record)}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {format(new Date(record.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {record.product_ml_permalink && (
                        <a
                          href={record.product_ml_permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
