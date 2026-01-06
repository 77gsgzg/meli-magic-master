import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const activities = [
  {
    id: 1,
    type: "success",
    message: "iPhone 15 Pro Max publicado com sucesso",
    time: "há 5 minutos",
  },
  {
    id: 2,
    type: "processing",
    message: "Otimizando descrição do MacBook Air M3",
    time: "há 10 minutos",
  },
  {
    id: 3,
    type: "ai",
    message: "IA sugeriu 3 melhorias para o título do produto",
    time: "há 15 minutos",
  },
  {
    id: 4,
    type: "error",
    message: "Falha ao publicar Apple Watch - categoria inválida",
    time: "há 20 minutos",
  },
  {
    id: 5,
    type: "success",
    message: "Token OAuth renovado automaticamente",
    time: "há 1 hora",
  },
];

const iconMap = {
  success: { icon: CheckCircle2, color: "text-success" },
  processing: { icon: Clock, color: "text-warning" },
  error: { icon: AlertCircle, color: "text-destructive" },
  ai: { icon: Sparkles, color: "text-primary" },
};

export function ActivityFeed() {
  return (
    <Card variant="glass" className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-lg">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity) => {
          const { icon: Icon, color } = iconMap[activity.type as keyof typeof iconMap];
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={cn("mt-0.5", color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{activity.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
