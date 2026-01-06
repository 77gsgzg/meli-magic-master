import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const history = [
  {
    id: 1,
    action: "Publicação",
    product: "iPhone 15 Pro Max 256GB - Titânio Natural",
    status: "success",
    message: "Produto publicado com sucesso",
    mlId: "MLB123456789",
    timestamp: "2024-01-15 14:32:15",
  },
  {
    id: 2,
    action: "Otimização IA",
    product: "MacBook Air M3 15\" 512GB",
    status: "processing",
    message: "Processando otimização de título e descrição",
    mlId: null,
    timestamp: "2024-01-15 14:30:00",
  },
  {
    id: 3,
    action: "Publicação",
    product: "Apple Watch Series 9 GPS 45mm",
    status: "error",
    message: "Erro: Categoria 'MLB12345' não encontrada",
    mlId: null,
    timestamp: "2024-01-15 14:25:00",
  },
  {
    id: 4,
    action: "Renovação Token",
    product: null,
    status: "success",
    message: "Token OAuth renovado automaticamente",
    mlId: null,
    timestamp: "2024-01-15 12:00:00",
  },
  {
    id: 5,
    action: "Publicação",
    product: "AirPods Pro 2ª Geração",
    status: "success",
    message: "Produto publicado com sucesso",
    mlId: "MLB123456791",
    timestamp: "2024-01-15 10:15:30",
  },
  {
    id: 6,
    action: "Validação",
    product: "iPad Pro 12.9\" M2 256GB",
    status: "warning",
    message: "Aviso: Título muito longo, recomendamos reduzir",
    mlId: null,
    timestamp: "2024-01-15 09:45:00",
  },
  {
    id: 7,
    action: "Extração",
    product: "Fone Bluetooth Premium ANC",
    status: "success",
    message: "Dados extraídos com sucesso da URL",
    mlId: null,
    timestamp: "2024-01-15 09:30:00",
  },
];

const statusConfig = {
  success: {
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/10",
  },
  error: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  processing: {
    icon: Clock,
    color: "text-warning",
    bg: "bg-warning/10",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/10",
  },
};

export default function History() {
  return (
    <DashboardLayout
      title="Histórico"
      subtitle="Acompanhe todas as operações realizadas"
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            Todos
          </Button>
          <Button variant="ghost" size="sm">
            Publicações
          </Button>
          <Button variant="ghost" size="sm">
            Otimizações
          </Button>
          <Button variant="ghost" size="sm">
            Erros
          </Button>
        </div>

        {/* History Timeline */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Registro de Atividades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {history.map((item, index) => {
              const config = statusConfig[item.status as keyof typeof statusConfig];
              const Icon = config.icon;
              
              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative flex gap-4 rounded-lg p-4 transition-colors hover:bg-secondary/30",
                    index !== history.length - 1 && "border-b border-border/30 pb-4"
                  )}
                >
                  {/* Status Icon */}
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", config.bg)}>
                    <Icon className={cn("h-5 w-5", config.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-normal">
                        {item.action}
                      </Badge>
                      {item.mlId && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {item.mlId}
                        </Badge>
                      )}
                    </div>
                    {item.product && (
                      <p className="font-medium text-foreground mt-1 truncate">
                        {item.product}
                      </p>
                    )}
                    <p className={cn("text-sm mt-1", config.color)}>
                      {item.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {item.timestamp}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {item.status === "error" && (
                      <Button variant="ghost" size="sm">
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Tentar novamente
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
