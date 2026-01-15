import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface TrendDataPoint {
  date: string;
  fullDate: string;
  publicados: number;
  criados: number;
  sucesso: number;
  falhas: number;
}

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
  trendData?: TrendDataPoint[];
}

// Chart drawing helpers
function drawLineChart(
  doc: jsPDF,
  data: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number],
  fillColor?: [number, number, number]
) {
  if (data.length < 2) return;

  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;
  const stepX = width / (data.length - 1);

  // Draw fill area
  if (fillColor) {
    doc.setFillColor(...fillColor);
    doc.setDrawColor(...fillColor);
    
    const points: [number, number][] = [];
    data.forEach((val, i) => {
      const px = x + i * stepX;
      const py = y + height - ((val - minVal) / range) * height;
      points.push([px, py]);
    });
    
    // Create path for fill
    doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    
    doc.moveTo(firstPoint[0], y + height);
    doc.lineTo(firstPoint[0], firstPoint[1]);
    points.forEach(([px, py]) => doc.lineTo(px, py));
    doc.lineTo(lastPoint[0], y + height);
    doc.lineTo(firstPoint[0], y + height);
    doc.fill();
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  }

  // Draw line
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);

  for (let i = 0; i < data.length - 1; i++) {
    const x1 = x + i * stepX;
    const y1 = y + height - ((data[i] - minVal) / range) * height;
    const x2 = x + (i + 1) * stepX;
    const y2 = y + height - ((data[i + 1] - minVal) / range) * height;
    doc.line(x1, y1, x2, y2);
  }

  // Draw points
  doc.setFillColor(...color);
  data.forEach((val, i) => {
    const px = x + i * stepX;
    const py = y + height - ((val - minVal) / range) * height;
    doc.circle(px, py, 1, "F");
  });
}

function drawBarChart(
  doc: jsPDF,
  data: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number]
) {
  if (data.length === 0) return;

  const maxVal = Math.max(...data, 1);
  const barWidth = (width / data.length) * 0.7;
  const gap = (width / data.length) * 0.3;

  doc.setFillColor(...color);

  data.forEach((val, i) => {
    const barHeight = (val / maxVal) * height;
    const bx = x + i * (barWidth + gap) + gap / 2;
    const by = y + height - barHeight;
    doc.roundedRect(bx, by, barWidth, barHeight, 1, 1, "F");
  });
}

function drawChartAxis(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  labels: string[],
  maxValue: number
) {
  // Draw axes
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(x, y, x, y + height); // Y axis
  doc.line(x, y + height, x + width, y + height); // X axis

  // Draw horizontal grid lines
  doc.setDrawColor(230, 230, 230);
  for (let i = 1; i <= 4; i++) {
    const gridY = y + (height / 4) * (4 - i);
    doc.line(x, gridY, x + width, gridY);
    
    // Y axis labels
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    const labelVal = Math.round((maxValue / 4) * i);
    doc.text(labelVal.toString(), x - 2, gridY + 1, { align: "right" });
  }

  // X axis labels (show subset to avoid crowding)
  const labelStep = Math.max(1, Math.floor(labels.length / 7));
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  
  labels.forEach((label, i) => {
    if (i % labelStep === 0 || i === labels.length - 1) {
      const lx = x + (i / (labels.length - 1)) * width;
      doc.text(label, lx, y + height + 4, { align: "center" });
    }
  });
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

  // Trend Charts Section
  if (data.trendData && data.trendData.length > 0) {
    // Check if we need a new page
    if (yPos > 160) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(79, 70, 229);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("📈 Evolução Temporal", 14, yPos);
    yPos += 10;

    const chartWidth = 85;
    const chartHeight = 45;
    const chartMargin = 10;

    // Products Created vs Published Chart
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Produtos Criados vs Publicados", 14, yPos);
    yPos += 5;

    const criadosData = data.trendData.map(d => d.criados);
    const publicadosData = data.trendData.map(d => d.publicados);
    const labels = data.trendData.map(d => d.date);
    const maxProducts = Math.max(...criadosData, ...publicadosData, 1);

    drawChartAxis(doc, 20, yPos, chartWidth, chartHeight, labels, maxProducts);
    drawLineChart(doc, criadosData, 20, yPos, chartWidth, chartHeight, [59, 130, 246], [59, 130, 246]);
    drawLineChart(doc, publicadosData, 20, yPos, chartWidth, chartHeight, [34, 197, 94]);

    // Legend for first chart
    doc.setFontSize(7);
    doc.setFillColor(59, 130, 246);
    doc.circle(20 + chartWidth + 5, yPos + 5, 2, "F");
    doc.setTextColor(100, 100, 100);
    doc.text("Criados", 20 + chartWidth + 9, yPos + 6);
    
    doc.setFillColor(34, 197, 94);
    doc.circle(20 + chartWidth + 5, yPos + 12, 2, "F");
    doc.text("Publicados", 20 + chartWidth + 9, yPos + 13);

    // Success vs Failures Chart (on the right)
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Sucesso vs Falhas", 115, yPos - 5);

    const sucessoData = data.trendData.map(d => d.sucesso);
    const falhasData = data.trendData.map(d => d.falhas);
    const maxEvents = Math.max(...sucessoData, ...falhasData, 1);

    drawChartAxis(doc, 120, yPos, chartWidth, chartHeight, labels, maxEvents);
    drawBarChart(doc, sucessoData, 120, yPos, chartWidth, chartHeight, [34, 197, 94]);

    // Overlay failures as line
    drawLineChart(doc, falhasData, 120, yPos, chartWidth, chartHeight, [239, 68, 68]);

    // Legend for second chart
    doc.setFontSize(7);
    doc.setFillColor(34, 197, 94);
    doc.rect(120 + chartWidth - 30, yPos + chartHeight + 8, 6, 3, "F");
    doc.setTextColor(100, 100, 100);
    doc.text("Sucesso", 120 + chartWidth - 22, yPos + chartHeight + 11);
    
    doc.setFillColor(239, 68, 68);
    doc.circle(120 + chartWidth - 5, yPos + chartHeight + 9.5, 2, "F");
    doc.text("Falhas", 120 + chartWidth - 1, yPos + chartHeight + 11);

    yPos += chartHeight + 25;

    // Trend Summary Table
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo do Período", 14, yPos);
    yPos += 5;

    const totalCreated = criadosData.reduce((a, b) => a + b, 0);
    const totalPublished = publicadosData.reduce((a, b) => a + b, 0);
    const totalSuccess = sucessoData.reduce((a, b) => a + b, 0);
    const totalFailures = falhasData.reduce((a, b) => a + b, 0);
    const avgCreatedPerDay = (totalCreated / data.trendData.length).toFixed(1);
    const avgPublishedPerDay = (totalPublished / data.trendData.length).toFixed(1);
    const successRate = totalSuccess + totalFailures > 0 
      ? ((totalSuccess / (totalSuccess + totalFailures)) * 100).toFixed(1) 
      : "0";

    const trendSummary = [
      ["Total Criados no Período", totalCreated.toString()],
      ["Total Publicados no Período", totalPublished.toString()],
      ["Média Diária de Criação", avgCreatedPerDay],
      ["Média Diária de Publicação", avgPublishedPerDay],
      ["Operações com Sucesso", totalSuccess.toString()],
      ["Operações com Falha", totalFailures.toString()],
      ["Taxa de Sucesso", `${successRate}%`],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [["Indicador", "Valor"]],
      body: trendSummary,
      theme: "striped",
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 80 },
        1: { cellWidth: 50 },
      },
      margin: { left: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // AI vs Manual Section
  // Check if we need a new page
  if (yPos > 160) {
    doc.addPage();
    yPos = 20;
  }

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
  if (yPos > 200) {
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
