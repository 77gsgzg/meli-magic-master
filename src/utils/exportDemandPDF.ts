import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { HeatmapCell, LoyaltyBuyer, ProductDemand } from "@/hooks/useDemandMetrics";
import { format } from "date-fns";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const TIER_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Prata",
  gold: "Ouro",
  platinum: "Platina",
};

export async function exportDemandPDF(
  data: {
    heatmap: HeatmapCell[];
    loyaltyBuyers: LoyaltyBuyer[];
    productDemand: ProductDemand[];
    peakHour: number;
    peakDay: number;
    avgLoyaltyScore: number;
  },
  aiForecast?: string | null
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(102, 126, 234);
  doc.text("Relatório de Previsão de Demanda", pageWidth / 2, yPos, { align: "center" });
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, yPos, { align: "center" });

  // Summary Section
  yPos += 15;
  doc.setFontSize(14);
  doc.setTextColor(40);
  doc.text("Resumo Executivo", 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(60);
  
  const lowStockCount = data.productDemand.filter(p => p.daysOfStock !== null && p.daysOfStock < 7).length;
  const tierCounts = data.loyaltyBuyers.reduce(
    (acc, b) => { acc[b.tier]++; return acc; },
    { bronze: 0, silver: 0, gold: 0, platinum: 0 }
  );
  
  const summaryItems = [
    `• Horário de pico: ${DAY_LABELS[data.peakDay]} às ${data.peakHour}h`,
    `• Score médio de fidelidade: ${data.avgLoyaltyScore}`,
    `• Produtos analisados: ${data.productDemand.length}`,
    `• Produtos com estoque crítico (<7 dias): ${lowStockCount}`,
    `• Clientes recorrentes: ${data.loyaltyBuyers.length}`,
    `  - Platina: ${tierCounts.platinum} | Ouro: ${tierCounts.gold} | Prata: ${tierCounts.silver} | Bronze: ${tierCounts.bronze}`,
  ];
  
  summaryItems.forEach(item => {
    doc.text(item, 14, yPos);
    yPos += 6;
  });

  // Heatmap Summary
  yPos += 10;
  doc.setFontSize(14);
  doc.setTextColor(40);
  doc.text("Mapa de Calor - Melhores Horários", 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(60);
  
  // Find top 5 time slots
  const topSlots = [...data.heatmap]
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);
  
  autoTable(doc, {
    startY: yPos,
    head: [["Dia/Hora", "Pedidos", "Receita"]],
    body: topSlots.map(s => [
      `${DAY_LABELS[s.dayOfWeek]} às ${s.hour}h`,
      s.orders.toString(),
      formatCurrency(s.revenue),
    ]),
    theme: "grid",
    headStyles: { fillColor: [102, 126, 234] },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Loyalty Buyers
  if (data.loyaltyBuyers.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text("Top Clientes por Fidelidade", 14, yPos);
    
    yPos += 8;
    
    autoTable(doc, {
      startY: yPos,
      head: [["Cliente", "Tier", "Score", "Pedidos", "Receita", "Freq/mês", "Última compra"]],
      body: data.loyaltyBuyers.slice(0, 15).map(b => [
        b.nickname.slice(0, 20),
        TIER_LABELS[b.tier],
        b.loyaltyScore.toString(),
        b.totalOrders.toString(),
        formatCurrency(b.totalRevenue),
        b.frequency.toFixed(1),
        `${b.daysSinceLastOrder}d atrás`,
      ]),
      theme: "grid",
      headStyles: { fillColor: [102, 126, 234] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 35 },
        4: { halign: "right" },
        5: { halign: "center" },
        6: { halign: "center" },
      },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Check if we need a new page
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }

  // Product Demand
  if (data.productDemand.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text("Análise de Demanda e Reabastecimento", 14, yPos);
    
    yPos += 8;
    
    const trendLabels: Record<string, string> = {
      up: "↑ Alta",
      down: "↓ Baixa",
      stable: "→ Estável",
    };
    
    autoTable(doc, {
      startY: yPos,
      head: [["Produto", "Vendidos", "Média/dia", "Tendência", "Estoque", "Dias", "Reabastecer"]],
      body: data.productDemand.slice(0, 20).map(p => [
        p.title.slice(0, 30) + (p.title.length > 30 ? "..." : ""),
        p.totalSold.toString(),
        p.avgDaily.toFixed(1),
        trendLabels[p.trend] || p.trend,
        p.availableQuantity?.toString() ?? "—",
        p.daysOfStock !== null ? `${p.daysOfStock}d` : "—",
        p.suggestedRestock.toString(),
      ]),
      theme: "grid",
      headStyles: { fillColor: [102, 126, 234] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
        6: { halign: "center" },
      },
      didParseCell: (data) => {
        // Highlight critical stock
        if (data.column.index === 5 && data.section === "body") {
          const cellText = String(data.cell.raw);
          if (cellText !== "—") {
            const days = parseInt(cellText);
            if (days < 7) {
              data.cell.styles.fillColor = [254, 215, 215];
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // AI Forecast
  if (aiForecast) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text("Previsão e Recomendações da IA", 14, yPos);
    
    yPos += 10;
    doc.setFontSize(9);
    doc.setTextColor(60);
    
    // Clean markdown and split into lines
    const cleanText = aiForecast
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "");
    
    const lines = doc.splitTextToSize(cleanText, pageWidth - 28);
    
    lines.forEach((line: string) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, 14, yPos);
      yPos += 5;
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, 290, { align: "center" });
  }

  doc.save(`relatorio-demanda-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
