import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface AnalyticsData {
  period: string;
  stats: {
    total: number;
    published: number;
    draft: number;
    pending: number;
    errors: number;
    paused: number;
    totalViews: number;
    totalSales: number;
    totalRevenue: number;
    aiOptimized: number;
    conversionRate: string;
  };
  aiStats: {
    ai: {
      count: number;
      published: number;
      publishRate: number;
      totalViews: number;
      avgViews: number;
      totalSales: number;
      avgSales: number;
      totalRevenue: number;
      avgRevenue: number;
      conversionRate: number;
    };
    manual: {
      count: number;
      published: number;
      publishRate: number;
      totalViews: number;
      avgViews: number;
      totalSales: number;
      avgSales: number;
      totalRevenue: number;
      avgRevenue: number;
      conversionRate: number;
    };
    improvements: {
      publishRate: number;
      avgViews: number;
      avgSales: number;
      avgRevenue: number;
      conversionRate: number;
    };
  };
  topProducts: Array<{
    title: string;
    views: number;
    sales: number;
    revenue: number;
  }>;
  categoryDistribution: Array<{
    name: string;
    value: number;
  }>;
  priceRangeDistribution: Array<{
    name: string;
    quantidade: number;
  }>;
}

export function exportAnalyticsPDF(data: AnalyticsData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(79, 70, 229); // Primary color
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Analytics", 14, 20);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${getPeriodLabel(data.period)}`, 14, 30);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 36);
  
  let yPos = 55;
  
  // Overview Section
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("📊 Visão Geral", 14, yPos);
  yPos += 8;
  
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const overviewData = [
    ["Total de Produtos", data.stats.total.toString()],
    ["Publicados", data.stats.published.toString()],
    ["Rascunho", data.stats.draft.toString()],
    ["Pendente", data.stats.pending.toString()],
    ["Erros", data.stats.errors.toString()],
    ["Pausados", data.stats.paused.toString()],
    ["Total de Visualizações", data.stats.totalViews.toLocaleString("pt-BR")],
    ["Total de Vendas", data.stats.totalSales.toString()],
    ["Faturamento Total", `R$ ${data.stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ["Otimizados por IA", `${data.stats.aiOptimized} (${data.stats.total > 0 ? ((data.stats.aiOptimized / data.stats.total) * 100).toFixed(0) : 0}%)`],
    ["Taxa de Conversão", `${data.stats.conversionRate}%`],
  ];
  
  autoTable(doc, {
    startY: yPos,
    head: [["Métrica", "Valor"]],
    body: overviewData,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 80 },
      1: { cellWidth: 80 },
    },
    margin: { left: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // AI vs Manual Section
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("🤖 Comparativo IA vs Manual", 14, yPos);
  yPos += 8;
  
  const aiComparisonData = [
    ["Quantidade de Produtos", data.aiStats.ai.count.toString(), data.aiStats.manual.count.toString(), "-"],
    ["Publicados", data.aiStats.ai.published.toString(), data.aiStats.manual.published.toString(), "-"],
    ["Taxa de Publicação", `${data.aiStats.ai.publishRate.toFixed(1)}%`, `${data.aiStats.manual.publishRate.toFixed(1)}%`, formatImprovement(data.aiStats.improvements.publishRate)],
    ["Total Visualizações", data.aiStats.ai.totalViews.toLocaleString("pt-BR"), data.aiStats.manual.totalViews.toLocaleString("pt-BR"), "-"],
    ["Média de Views", data.aiStats.ai.avgViews.toFixed(0), data.aiStats.manual.avgViews.toFixed(0), formatImprovement(data.aiStats.improvements.avgViews)],
    ["Total Vendas", data.aiStats.ai.totalSales.toString(), data.aiStats.manual.totalSales.toString(), "-"],
    ["Média de Vendas", data.aiStats.ai.avgSales.toFixed(1), data.aiStats.manual.avgSales.toFixed(1), formatImprovement(data.aiStats.improvements.avgSales)],
    ["Receita Total", `R$ ${data.aiStats.ai.totalRevenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, `R$ ${data.aiStats.manual.totalRevenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, "-"],
    ["Receita Média", `R$ ${data.aiStats.ai.avgRevenue.toFixed(0)}`, `R$ ${data.aiStats.manual.avgRevenue.toFixed(0)}`, formatImprovement(data.aiStats.improvements.avgRevenue)],
    ["Taxa de Conversão", `${data.aiStats.ai.conversionRate.toFixed(2)}%`, `${data.aiStats.manual.conversionRate.toFixed(2)}%`, formatImprovement(data.aiStats.improvements.conversionRate)],
  ];
  
  autoTable(doc, {
    startY: yPos,
    head: [["Métrica", "Com IA", "Sem IA", "Diferença"]],
    body: aiComparisonData,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 40, halign: "center" },
      3: { cellWidth: 35, halign: "center" },
    },
    margin: { left: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // Check if we need a new page
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }
  
  // Top Products Section
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("🏆 Top 5 Produtos", 14, yPos);
  yPos += 8;
  
  const topProductsData = data.topProducts.map((p, i) => [
    `${i + 1}º`,
    p.title,
    p.views.toLocaleString("pt-BR"),
    p.sales.toString(),
    `R$ ${p.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [["#", "Produto", "Views", "Vendas", "Receita"]],
    body: topProductsData,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 35, halign: "right" },
    },
    margin: { left: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // Check if we need a new page
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }
  
  // Category Distribution
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("📦 Distribuição por Categoria", 14, yPos);
  yPos += 8;
  
  const categoryData = data.categoryDistribution.map((c) => [
    c.name,
    c.value.toString(),
    data.stats.total > 0 ? `${((c.value / data.stats.total) * 100).toFixed(1)}%` : "0%",
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [["Categoria", "Quantidade", "Porcentagem"]],
    body: categoryData,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 40, halign: "center" },
    },
    margin: { left: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // Check if we need a new page
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }
  
  // Price Range Distribution
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("💰 Distribuição por Faixa de Preço", 14, yPos);
  yPos += 8;
  
  const priceData = data.priceRangeDistribution.map((p) => [
    p.name,
    p.quantidade.toString(),
    data.stats.total > 0 ? `${((p.quantidade / data.stats.total) * 100).toFixed(1)}%` : "0%",
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [["Faixa de Preço", "Quantidade", "Porcentagem"]],
    body: priceData,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 50, halign: "center" },
      2: { cellWidth: 50, halign: "center" },
    },
    margin: { left: 14 },
  });
  
  // Footer on all pages
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }
  
  // Save the PDF
  const fileName = `analytics-report-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`;
  doc.save(fileName);
  
  return fileName;
}

function getPeriodLabel(period: string): string {
  switch (period) {
    case "7d":
      return "Últimos 7 dias";
    case "30d":
      return "Últimos 30 dias";
    case "90d":
      return "Últimos 90 dias";
    case "all":
      return "Todo o período";
    default:
      return period;
  }
}

function formatImprovement(value: number): string {
  if (value === 0) return "0%";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}
