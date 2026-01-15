import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Filter,
  X,
  CalendarIcon,
  Search,
} from "lucide-react";

export interface WebhookLogsFilters {
  search: string;
  eventType: string;
  status: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

interface WebhookLogsFilterProps {
  filters: WebhookLogsFilters;
  onFiltersChange: (filters: WebhookLogsFilters) => void;
  eventTypes: string[];
}

export function WebhookLogsFilter({
  filters,
  onFiltersChange,
  eventTypes,
}: WebhookLogsFilterProps) {
  const [isCalendarFromOpen, setIsCalendarFromOpen] = useState(false);
  const [isCalendarToOpen, setIsCalendarToOpen] = useState(false);

  const updateFilter = <K extends keyof WebhookLogsFilters>(
    key: K,
    value: WebhookLogsFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      eventType: "",
      status: "",
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const activeFiltersCount = [
    filters.search,
    filters.eventType,
    filters.status,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nos logs..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Event Type Filter */}
        <Select
          value={filters.eventType}
          onValueChange={(value) => updateFilter("eventType", value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os eventos</SelectItem>
            {eventTypes.map((event) => (
              <SelectItem key={event} value={event}>
                {event}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status}
          onValueChange={(value) => updateFilter("status", value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="failed">Falha</SelectItem>
          </SelectContent>
        </Select>

        {/* Date From */}
        <Popover open={isCalendarFromOpen} onOpenChange={setIsCalendarFromOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "Data início"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(date) => {
                updateFilter("dateFrom", date);
                setIsCalendarFromOpen(false);
              }}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover open={isCalendarToOpen} onOpenChange={setIsCalendarToOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "Data fim"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(date) => {
                updateFilter("dateTo", date);
                setIsCalendarToOpen(false);
              }}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Limpar ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filtros ativos:
          </span>
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Busca: "{filters.search}"
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("search", "")}
              />
            </Badge>
          )}
          {filters.eventType && (
            <Badge variant="secondary" className="gap-1">
              Evento: {filters.eventType}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("eventType", "")}
              />
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status === "success" ? "Sucesso" : "Falha"}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("status", "")}
              />
            </Badge>
          )}
          {filters.dateFrom && (
            <Badge variant="secondary" className="gap-1">
              De: {format(filters.dateFrom, "dd/MM/yyyy")}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("dateFrom", undefined)}
              />
            </Badge>
          )}
          {filters.dateTo && (
            <Badge variant="secondary" className="gap-1">
              Até: {format(filters.dateTo, "dd/MM/yyyy")}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("dateTo", undefined)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
