import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface ProductProfitability {
  id: string;
  title: string;
  supplierPrice: number;
  expectedMargin: number;
  targetPrice: number;
  realRevenue: number;
  realCost: number;
  realMargin: number;
  unitsSold: number;
  marginDiff: number;
  status: "above" | "below" | "on_target";
}

interface ProfitabilitySummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageMargin: number;
  expectedAverageMargin: number;
  marginDiff: number;
  productsAboveTarget: number;
  productsBelowTarget: number;
  productsOnTarget: number;
}

interface PriceRecommendation {
  productId: string;
  title: string;
  currentPrice: number;
  recommendedPrice: number;
  supplierPrice: number;
  currentMargin: number;
  targetMargin: number;
  marginDiff: number;
  reason: string;
  priority: "high" | "medium" | "low";
  action: "increase" | "decrease" | "maintain";
  potentialImpact: number;
}

interface ExportData {
  products: ProductProfitability[];
  summary: ProfitabilitySummary;
  recommendations: PriceRecommendation[];
  period: string;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export async function exportSupplierProfitabilityPDF(data: ExportData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(102, 126, 234);
  doc.text("Relatório de Rentabilidade", pageWidth / 2, yPos, { align: "center" });

  yPos += 10;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, yPos, { align: "center" });

  yPos += 6;
  doc.text(`Período: ${data.period}`, pageWidth / 2, yPos, { align: "center" });

  // Summary Section
  yPos += 15;
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text("Resumo Executivo", 14, yPos);

  yPos += 10;
  
  // Draw KPI Cards
  const cardWidth = 45;
  const cardHeight = 30;
  const cardGap = 4;
  const startX = 14;

  // Card 1 - Total Revenue
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(startX, yPos, cardWidth, cardHeight, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Receita Total", startX + 4, yPos + 8);
  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text(formatCurrency(data.summary.totalRevenue), startX + 4, yPos + 18);
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text(`Custo: ${formatCurrency(data.summary.totalCost)}`, startX + 4, yPos + 25);

  // Card 2 - Total Profit
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(startX + cardWidth + cardGap, yPos, cardWidth, cardHeight, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Lucro Total", startX + cardWidth + cardGap + 4, yPos + 8);
  doc.setFontSize(12);
  doc.setTextColor(34, 197, 94);
  doc.text(formatCurrency(data.summary.totalProfit), startX + cardWidth + cardGap + 4, yPos + 18);
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text(`${data.products.length} produtos vendidos`, startX + cardWidth + cardGap + 4, yPos + 25);

  // Card 3 - Real Margin
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(startX + (cardWidth + cardGap) * 2, yPos, cardWidth, cardHeight, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Margem Real", startX + (cardWidth + cardGap) * 2 + 4, yPos + 8);
  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text(formatPercent(data.summary.averageMargin), startX + (cardWidth + cardGap) * 2 + 4, yPos + 18);
  doc.setFontSize(7);
  const marginDiffColor = data.summary.marginDiff >= 0 ? [34, 197, 94] : [239, 68, 68];
  doc.setTextColor(...marginDiffColor as [number, number, number]);
  const marginDiffText = data.summary.marginDiff >= 0 ? `+${data.summary.marginDiff}%` : `${data.summary.marginDiff}%`;
  doc.text(`${marginDiffText} vs esperado`, startX + (cardWidth + cardGap) * 2 + 4, yPos + 25);

  // Card 4 - Expected Margin
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(startX + (cardWidth + cardGap) * 3, yPos, cardWidth, cardHeight, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Margem Esperada", startX + (cardWidth + cardGap) * 3 + 4, yPos + 8);
  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text(formatPercent(data.summary.expectedAverageMargin), startX + (cardWidth + cardGap) * 3 + 4, yPos + 18);
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text("Meta média configurada", startX + (cardWidth + cardGap) * 3 + 4, yPos + 25);

  yPos += cardHeight + 10;

  // Distribution Summary
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text("Distribuição de Produtos por Meta:", 14, yPos);
  yPos += 6;
  doc.setTextColor(34, 197, 94);
  doc.text(`• Acima da Meta: ${data.summary.productsAboveTarget} produtos`, 14, yPos);
  yPos += 5;
  doc.setTextColor(59, 130, 246);
  doc.text(`• Na Meta: ${data.summary.productsOnTarget} produtos`, 14, yPos);
  yPos += 5;
  doc.setTextColor(239, 68, 68);
  doc.text(`• Abaixo da Meta: ${data.summary.productsBelowTarget} produtos`, 14, yPos);

  // Products Table
  yPos += 15;
  doc.setFontSize(14);
  doc.setTextColor(40);
  doc.text("Detalhamento por Produto", 14, yPos);

  yPos += 8;

  if (data.products.length > 0) {
    const statusLabels = {
      above: "↑ Acima",
      below: "↓ Abaixo",
      on_target: "→ Na Meta",
    };

    autoTable(doc, {
      startY: yPos,
      head: [["Produto", "Vendidos", "Receita", "Custo", "Margem Real", "Margem Esperada", "Status"]],
      body: data.products.slice(0, 20).map((p) => [
        p.title.substring(0, 25) + (p.title.length > 25 ? "..." : ""),
        p.unitsSold.toString(),
        formatCurrency(p.realRevenue),
        formatCurrency(p.realCost),
        formatPercent(p.realMargin),
        formatPercent(p.expectedMargin),
        statusLabels[p.status],
      ]),
      theme: "grid",
      headStyles: { fillColor: [102, 126, 234], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 45 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "center" },
        5: { halign: "center" },
        6: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Check if we need a new page for recommendations
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }

  // Price Recommendations Section
  if (data.recommendations.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text("Recomendações de Ajuste de Preço", 14, yPos);

    yPos += 5;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Sugestões baseadas na análise de margem real vs esperada", 14, yPos);

    yPos += 10;

    // Recommendations summary
    const highPriority = data.recommendations.filter((r) => r.priority === "high").length;
    const mediumPriority = data.recommendations.filter((r) => r.priority === "medium").length;
    const lowPriority = data.recommendations.filter((r) => r.priority === "low").length;
    const totalImpact = data.recommendations.reduce((sum, r) => sum + r.potentialImpact, 0);

    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`Total de Recomendações: ${data.recommendations.length}`, 14, yPos);
    yPos += 5;
    doc.setTextColor(239, 68, 68);
    doc.text(`Alta Prioridade: ${highPriority}`, 14, yPos);
    doc.setTextColor(234, 179, 8);
    doc.text(`Média Prioridade: ${mediumPriority}`, 70, yPos);
    doc.setTextColor(34, 197, 94);
    doc.text(`Impacto Potencial: ${formatCurrency(totalImpact)}`, 130, yPos);

    yPos += 10;

    const priorityLabels = {
      high: "Alta",
      medium: "Média",
      low: "Baixa",
    };

    const actionLabels = {
      increase: "↑ Aumentar",
      decrease: "↓ Reduzir",
      maintain: "→ Manter",
    };

    autoTable(doc, {
      startY: yPos,
      head: [["Produto", "Prioridade", "Ação", "Preço Atual", "Preço Recomendado", "Margem Atual", "Meta", "Impacto"]],
      body: data.recommendations.slice(0, 15).map((r) => [
        r.title.substring(0, 20) + (r.title.length > 20 ? "..." : ""),
        priorityLabels[r.priority],
        actionLabels[r.action],
        formatCurrency(r.currentPrice),
        formatCurrency(r.recommendedPrice),
        formatPercent(r.currentMargin),
        formatPercent(r.targetMargin),
        formatCurrency(r.potentialImpact),
      ]),
      theme: "grid",
      headStyles: { fillColor: [234, 179, 8], fontSize: 7, textColor: [0, 0, 0] },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 35 },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "center" },
        6: { halign: "center" },
        7: { halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Check if we need a new page for detailed recommendations
    if (yPos > 200 && data.recommendations.length > 0) {
      doc.addPage();
      yPos = 20;
    }

    // Detailed recommendations with reasons
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text("Detalhes das Recomendações", 14, yPos);
    yPos += 8;

    for (const rec of data.recommendations.slice(0, 8)) {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      // Priority color bar
      const priorityColors: Record<string, [number, number, number]> = {
        high: [239, 68, 68],
        medium: [234, 179, 8],
        low: [34, 197, 94],
      };
      doc.setFillColor(...priorityColors[rec.priority]);
      doc.rect(14, yPos - 3, 2, 20, "F");

      doc.setFontSize(10);
      doc.setTextColor(40);
      doc.text(rec.title.substring(0, 50) + (rec.title.length > 50 ? "..." : ""), 20, yPos);

      yPos += 5;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(rec.reason, 20, yPos, { maxWidth: 170 });

      yPos += 8;
      doc.setTextColor(60);
      doc.text(
        `${formatCurrency(rec.currentPrice)} → ${formatCurrency(rec.recommendedPrice)} | ` +
          `Margem: ${formatPercent(rec.currentMargin)} → ${formatPercent(rec.targetMargin)} | ` +
          `Impacto: ${formatCurrency(rec.potentialImpact)}`,
        20,
        yPos
      );

      yPos += 12;
    }
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${totalPages} | Relatório de Rentabilidade de Fornecedores`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  doc.save(`rentabilidade-fornecedor-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`);
}
