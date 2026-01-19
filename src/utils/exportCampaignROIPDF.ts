import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignHistory {
  id: string;
  campaign_type: string;
  status: string;
  recipients_count: number;
  converted_count: number;
  details: Record<string, any> | null;
  created_at: string;
}

interface ROIMetrics {
  totalCampaigns: number;
  reactivationCampaigns: number;
  stockAlertCampaigns: number;
  totalReactivationRecipients: number;
  totalReactivationConverted: number;
  reactivationConversionRate: number;
  estimatedReactivationRevenue: number;
  reactivationCampaignCost: number;
  reactivationROI: number;
  netProfit: number;
  monthlyBreakdown: Array<{
    month: string;
    revenue: number;
    converted: number;
    recipients: number;
  }>;
}

interface SimulatorScenario {
  name: string;
  conversionRate: number;
  averageTicket: number;
  projectedRevenue: number;
  projectedROI: number;
}

interface PeriodComparison {
  period: string;
  revenue: number;
  conversionRate: number;
  recipients: number;
  converted: number;
}

export async function exportCampaignROIPDF(
  campaigns: CampaignHistory[],
  metrics: ROIMetrics,
  averageOrderValue: number,
  campaignCost: number,
  simulatorScenarios?: SimulatorScenario[],
  periodComparison?: PeriodComparison[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let yPos = 20;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185);
  doc.text("Relatório de ROI - Campanhas", margin, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`, margin, yPos);

  // Summary Box
  yPos += 15;
  doc.setFillColor(240, 248, 255);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 45, 3, 3, "F");
  
  yPos += 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185);
  doc.text("Resumo Executivo", margin + 5, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  // Summary metrics in two columns
  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;
  
  doc.text(`Total de Campanhas: ${metrics.totalCampaigns}`, col1X, yPos);
  doc.text(`ROI: ${metrics.reactivationROI.toFixed(1)}%`, col2X, yPos);
  
  yPos += 6;
  doc.text(`Clientes Alcançados: ${metrics.totalReactivationRecipients.toLocaleString()}`, col1X, yPos);
  doc.text(`Conversões: ${metrics.totalReactivationConverted}`, col2X, yPos);
  
  yPos += 6;
  doc.text(`Receita Estimada: ${formatCurrency(metrics.estimatedReactivationRevenue)}`, col1X, yPos);
  doc.text(`Lucro Líquido: ${formatCurrency(metrics.netProfit)}`, col2X, yPos);
  
  yPos += 6;
  doc.text(`Taxa de Conversão: ${metrics.reactivationConversionRate.toFixed(1)}%`, col1X, yPos);
  doc.text(`Custo Total: ${formatCurrency(metrics.reactivationCampaignCost)}`, col2X, yPos);

  // KPI Section
  yPos += 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185);
  doc.text("Indicadores de Performance (KPIs)", margin, yPos);

  yPos += 8;
  const kpiData = [
    ["Métrica", "Valor", "Descrição"],
    ["Receita Estimada", formatCurrency(metrics.estimatedReactivationRevenue), "Total de receita gerada pelas conversões"],
    ["ROI das Campanhas", `${metrics.reactivationROI.toFixed(1)}%`, "Retorno sobre o investimento em campanhas"],
    ["Taxa de Conversão", `${metrics.reactivationConversionRate.toFixed(1)}%`, "Porcentagem de destinatários que converteram"],
    ["Custo por Aquisição", formatCurrency(metrics.totalReactivationConverted > 0 ? metrics.reactivationCampaignCost / metrics.totalReactivationConverted : 0), "Custo médio para adquirir uma conversão"],
    ["Ticket Médio", formatCurrency(averageOrderValue), "Valor médio por pedido"],
    ["Custo por Contato", formatCurrency(campaignCost), "Custo unitário de cada contato"],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [kpiData[0]],
    body: kpiData.slice(1),
    theme: "striped",
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 250, 255] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { cellWidth: 45, halign: "right" },
      2: { cellWidth: "auto" },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Monthly Revenue Table
  if (metrics.monthlyBreakdown.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    doc.text("Receita Mensal", margin, yPos);

    yPos += 8;
    const monthlyData = [
      ["Mês", "Destinatários", "Conversões", "Receita"],
      ...metrics.monthlyBreakdown.map((m) => [
        m.month,
        m.recipients.toLocaleString(),
        m.converted.toString(),
        formatCurrency(m.revenue),
      ]),
    ];

    autoTable(doc, {
      startY: yPos,
      head: [monthlyData[0]],
      body: monthlyData.slice(1),
      theme: "striped",
      headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 255, 250] },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        3: { halign: "right" },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Check if we need a new page
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  // ROI Breakdown
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185);
  doc.text("Análise Detalhada de ROI", margin, yPos);

  yPos += 8;
  const roiBreakdown = [
    ["Item", "Valor"],
    ["Custo por contato", formatCurrency(campaignCost)],
    ["Total de contatos", metrics.totalReactivationRecipients.toLocaleString()],
    ["Custo total das campanhas", formatCurrency(metrics.reactivationCampaignCost)],
    ["Ticket médio", formatCurrency(averageOrderValue)],
    ["Total de conversões", metrics.totalReactivationConverted.toString()],
    ["Receita gerada", formatCurrency(metrics.estimatedReactivationRevenue)],
    ["Lucro líquido", formatCurrency(metrics.netProfit)],
    ["ROI Final", `${metrics.reactivationROI.toFixed(1)}%`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [roiBreakdown[0]],
    body: roiBreakdown.slice(1),
    theme: "striped",
    headStyles: { fillColor: [155, 89, 182], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 245, 255] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 80 },
      1: { halign: "right" },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Simulator Scenarios (if provided)
  if (simulatorScenarios && simulatorScenarios.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    doc.text("Simulação de Cenários", margin, yPos);

    yPos += 8;
    const scenarioData = [
      ["Cenário", "Taxa Conv.", "Ticket Médio", "Receita Projetada", "ROI Projetado"],
      ...simulatorScenarios.map((s) => [
        s.name,
        `${s.conversionRate.toFixed(1)}%`,
        formatCurrency(s.averageTicket),
        formatCurrency(s.projectedRevenue),
        `${s.projectedROI.toFixed(0)}%`,
      ]),
    ];

    autoTable(doc, {
      startY: yPos,
      head: [scenarioData[0]],
      body: scenarioData.slice(1),
      theme: "striped",
      headStyles: { fillColor: [230, 126, 34], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [255, 250, 245] },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Period Comparison Section (NEW)
  if (periodComparison && periodComparison.length > 0) {
    if (yPos > 180) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    doc.text("Comparativo de Períodos", margin, yPos);

    yPos += 8;
    const periodData = [
      ["Período", "Receita", "Taxa Conv.", "Destinatários", "Conversões"],
      ...periodComparison.map((p) => [
        p.period,
        formatCurrency(p.revenue),
        `${p.conversionRate.toFixed(1)}%`,
        p.recipients.toLocaleString(),
        p.converted.toString(),
      ]),
    ];

    autoTable(doc, {
      startY: yPos,
      head: [periodData[0]],
      body: periodData.slice(1),
      theme: "striped",
      headStyles: { fillColor: [22, 160, 133], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 255, 250] },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Period variation analysis
    if (periodComparison.length >= 2) {
      const current = periodComparison[0];
      const previous = periodComparison[1];
      
      const revenueChange = previous.revenue > 0 
        ? ((current.revenue - previous.revenue) / previous.revenue * 100).toFixed(1)
        : "N/A";
      const conversionChange = previous.conversionRate > 0
        ? ((current.conversionRate - previous.conversionRate) / previous.conversionRate * 100).toFixed(1)
        : "N/A";

      doc.setFillColor(245, 250, 255);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 25, 3, 3, "F");
      
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("Variação entre períodos:", margin + 5, yPos);
      
      yPos += 7;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(`Receita: ${revenueChange}% | Conversão: ${conversionChange}%`, margin + 5, yPos);
      
      yPos += 15;
    }
  }

  // Campaign History (last 10)
  if (campaigns.length > 0) {
    if (yPos > 180) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    doc.text("Histórico de Campanhas (Últimas 10)", margin, yPos);

    yPos += 8;
    const campaignData = [
      ["Data", "Tipo", "Destinatários", "Convertidos", "Taxa Conv."],
      ...campaigns.slice(0, 10).map((c) => [
        format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR }),
        c.campaign_type === "reactivation" ? "Reativação" : "Alerta Estoque",
        c.recipients_count.toString(),
        c.converted_count.toString(),
        c.recipients_count > 0 
          ? `${((c.converted_count / c.recipients_count) * 100).toFixed(1)}%`
          : "0%",
      ]),
    ];

    autoTable(doc, {
      startY: yPos,
      head: [campaignData[0]],
      body: campaignData.slice(1),
      theme: "striped",
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      styles: { fontSize: 9, cellPadding: 4 },
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `ML Manager - Relatório de ROI de Campanhas | Página ${i} de ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  const fileName = `roi-campanhas-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`;
  doc.save(fileName);
  
  return fileName;
}
