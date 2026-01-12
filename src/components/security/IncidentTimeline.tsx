import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

 type PublicationHistory = Tables<'publication_history'>;
 type OperationLog = Tables<'operation_logs'>;

interface IncidentTimelinePoint {
  timestamp: string;
  type: "publication_error" | "integration_error";
  label: string;
}

interface IncidentTimelineProps {
  publication: PublicationHistory[];
  logs: OperationLog[];
  onSelectPoint?: (params: { timestamp: string; type: "publication_error" | "integration_error"; label: string }) => void;
}

export function IncidentTimeline({ publication, logs, onSelectPoint }: IncidentTimelineProps) {
  const [data, setData] = useState<IncidentTimelinePoint[]>([]);

  useEffect(() => {
    const points: IncidentTimelinePoint[] = [];

    publication
      .filter((p) => p.status === "error")
      .forEach((p) => {
        points.push({
          timestamp: p.created_at,
          type: "publication_error",
          label: p.error_details || "Erro de publicação",
        });
      });

    logs
      .filter((l) => l.status === "error" && l.entity_type === "mercado_livre")
      .forEach((l) => {
        points.push({
          timestamp: l.created_at,
          type: "integration_error",
          label: l.error_message || l.operation_type || "Erro de integração",
        });
      });

    points.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
    setData(points);
  }, [publication, logs]);

  if (data.length === 0) return null;

  const chartData = data.map((p, index) => ({
    index,
    time: new Date(p.timestamp).toLocaleString(),
    y: p.type === "publication_error" ? 1 : 2,
    type: p.type,
    label: p.label,
    _timestamp: p.timestamp,
  }));

  return (
    <Card className="p-4 space-y-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Linha do tempo de incidentes Mercado Livre</CardTitle>
      </CardHeader>
      <CardContent className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ left: 8, right: 8, top: 8, bottom: 16 }}
            onClick={(state: any) => {
              const payload = state?.activePayload?.[0]?.payload as any;
              if (!payload || !onSelectPoint) return;
              onSelectPoint({
                timestamp: payload._timestamp as string,
                type: payload.type as "publication_error" | "integration_error",
                label: payload.label as string,
              });
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              angle={-30}
              textAnchor="end"
              height={40}
            />
            <YAxis
              dataKey="y"
              domain={[0, 3]}
              ticks={[1, 2]}
              tickFormatter={(v) => (v === 1 ? "Publicação" : "Integração")}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 11 }}
              formatter={(_, __, props) => {
                const p = props?.payload as any;
                return [p.label, p.type === "publication_error" ? "Erro de publicação" : "Erro de integração"];
              }}
            />
            <Line
              type="linear"
              dataKey="y"
              stroke="hsl(var(--destructive))"
              strokeWidth={1}
              dot={{ r: 3 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
