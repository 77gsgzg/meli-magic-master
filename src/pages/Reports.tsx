import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, Calendar, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useRequireAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR, es, enUS } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import html2canvas from "html2canvas";
import { toast } from "sonner";

const COLORS = ["hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--info))"];

export default function Reports() {
  const { user, loading: authLoading } = useRequireAuth();
  const { t, language } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const locale = language === "pt-BR" ? ptBR : language === "es" ? es : enUS;

  // Generate last 12 months options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale }),
    };
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["monthly-report", selectedMonth, user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      const { data: logs, error } = await supabase
        .from("operation_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Process data
      const total = logs?.length || 0;
      const successful = logs?.filter((l) => l.status === "success").length || 0;
      const errors = logs?.filter((l) => l.status === "error").length || 0;
      const successRate = total > 0 ? ((successful / total) * 100).toFixed(1) : "0";

      // By type
      const byType: Record<string, { success: number; error: number }> = {};
      logs?.forEach((log) => {
        if (!byType[log.operation_type]) {
          byType[log.operation_type] = { success: 0, error: 0 };
        }
        if (log.status === "success") {
          byType[log.operation_type].success++;
        } else {
          byType[log.operation_type].error++;
        }
      });

      const typeData = Object.entries(byType).map(([type, counts]) => ({
        name: type,
        success: counts.success,
        error: counts.error,
      }));

      // By day
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const byDay = days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayLogs = logs?.filter((l) => l.created_at.startsWith(dayStr)) || [];
        return {
          date: format(day, "dd"),
          success: dayLogs.filter((l) => l.status === "success").length,
          error: dayLogs.filter((l) => l.status === "error").length,
        };
      });

      // Status distribution for pie chart
      const statusData = [
        { name: t("common.success"), value: successful, color: "hsl(var(--success))" },
        { name: t("common.error"), value: errors, color: "hsl(var(--destructive))" },
      ].filter((d) => d.value > 0);

      return {
        total,
        successful,
        errors,
        successRate,
        typeData,
        byDay,
        statusData,
        startDate,
        endDate,
        logs,
      };
    },
    enabled: !!user,
  });

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;

    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = `report-${selectedMonth}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success(t("common.success"), {
        description: "Relatório exportado com sucesso!",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(t("common.error"), {
        description: "Erro ao gerar o relatório",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout title={t("reports.title")} subtitle={t("reports.subtitle")}>
      <div className="space-y-6">
        {/* Controls */}
        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={t("reports.selectMonth")} />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleDownloadPDF} disabled={isGeneratingPDF || !reportData?.total}>
                {isGeneratingPDF ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t("reports.download")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !reportData?.total ? (
          <Card variant="glass">
            <CardContent className="py-20 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("reports.noData")}</p>
            </CardContent>
          </Card>
        ) : (
          <div ref={reportRef} className="space-y-6 bg-background p-6 rounded-lg">
            {/* Header */}
            <div className="text-center border-b border-border pb-6">
              <h1 className="text-2xl font-bold text-foreground">{t("reports.monthly")}</h1>
              <p className="text-muted-foreground">
                {format(reportData.startDate, "dd MMMM", { locale })} -{" "}
                {format(reportData.endDate, "dd MMMM yyyy", { locale })}
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card variant="glass">
                <CardContent className="pt-6 text-center">
                  <FileText className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-3xl font-bold text-foreground">{reportData.total}</p>
                  <p className="text-sm text-muted-foreground">{t("reports.totalOperations")}</p>
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardContent className="pt-6 text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2" />
                  <p className="text-3xl font-bold text-success">{reportData.successful}</p>
                  <p className="text-sm text-muted-foreground">{t("common.success")}</p>
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardContent className="pt-6 text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
                  <p className="text-3xl font-bold text-destructive">{reportData.errors}</p>
                  <p className="text-sm text-muted-foreground">{t("reports.errors")}</p>
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardContent className="pt-6 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto text-info mb-2" />
                  <p className="text-3xl font-bold text-info">{reportData.successRate}%</p>
                  <p className="text-sm text-muted-foreground">{t("reports.successRate")}</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By Type */}
              <Card variant="glass">
                <CardHeader>
                  <CardTitle>{t("reports.byType")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.typeData}>
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="success" name={t("common.success")} fill="hsl(var(--success))" radius={4} />
                        <Bar dataKey="error" name={t("common.error")} fill="hsl(var(--destructive))" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card variant="glass">
                <CardHeader>
                  <CardTitle>{t("reports.summary")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportData.statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {reportData.statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* By Day */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle>{t("reports.byDay")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.byDay}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="success" name={t("common.success")} stackId="a" fill="hsl(var(--success))" />
                      <Bar dataKey="error" name={t("common.error")} stackId="a" fill="hsl(var(--destructive))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
