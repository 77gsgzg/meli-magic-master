import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

 type OperationLog = Tables<'operation_logs'>;

interface AggregatedIncidentsProps {
  logs: OperationLog[];
  onSelectIncident?: (params: { entityId: string; start: string; end: string }) => void;
}

interface IncidentGroup {
  id: string;
  entityId: string;
  count: number;
  firstAt: string;
  lastAt: string;
  statuses: Set<string>;
  operations: Set<string>;
}

export function AggregatedIncidents({ logs, onSelectIncident }: AggregatedIncidentsProps) {
  const incidents = useMemo<IncidentGroup[]>(() => {
    const map = new Map<string, IncidentGroup>();

    logs.forEach((log) => {
      const entityId = log.entity_id || "sem-entidade";
      const key = entityId;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          id: key,
          entityId,
          count: 1,
          firstAt: log.created_at,
          lastAt: log.created_at,
          statuses: new Set([log.status]),
          operations: new Set([log.operation_type]),
        });
      } else {
        existing.count += 1;
        if (log.created_at < existing.firstAt) existing.firstAt = log.created_at;
        if (log.created_at > existing.lastAt) existing.lastAt = log.created_at;
        existing.statuses.add(log.status);
        existing.operations.add(log.operation_type);
      }
    });

    return Array.from(map.values()).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }, [logs]);

  if (incidents.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Incidentes agregados (por entidade)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[360px] overflow-auto">
        {incidents.map((incident) => {
          const hasErrors = incident.statuses.has("error");
          const hasSuccess = incident.statuses.has("success");
          const clickable = incident.entityId !== "sem-entidade" && !!onSelectIncident;
          return (
            <button
              key={incident.id}
              type="button"
              onClick={() => {
                if (!clickable || !onSelectIncident) return;
                onSelectIncident({
                  entityId: incident.entityId,
                  start: incident.firstAt,
                  end: incident.lastAt,
                });
              }}
              className={"flex flex-col gap-1 rounded-md border border-border p-3 text-xs text-left bg-background transition-colors " + (clickable ? "hover:bg-muted/70 cursor-pointer" : "cursor-default")}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={hasErrors ? "destructive" : "default"}>
                    {hasErrors ? "Com erros" : "Sem erros"}
                  </Badge>
                  <span className="font-medium text-foreground">
                    Entidade: {incident.entityId === "sem-entidade" ? "(sem entidade)" : incident.entityId}
                  </span>
                  <span className="text-muted-foreground">{incident.count} eventos</span>
                </div>
                <span className="text-muted-foreground">
                  Último: {new Date(incident.lastAt).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>
                  Janela: {new Date(incident.firstAt).toLocaleString()} - {" "}
                  {new Date(incident.lastAt).toLocaleString()}
                </span>
                <span> Status: {Array.from(incident.statuses).join(", ")}</span>
                <span> Operações: {Array.from(incident.operations).join(", ")}</span>
                {hasSuccess && hasErrors && (
                  <span className="text-destructive font-medium">
                    Erros após tentativas bem-sucedidas
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
