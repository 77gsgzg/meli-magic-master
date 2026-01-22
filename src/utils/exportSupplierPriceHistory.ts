import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PriceHistoryEntry {
  id: string;
  supplier_product_id: string;
  old_price: number;
  new_price: number;
  price_change_percent: number;
  detected_at: string;
  alert_sent: boolean;
  productTitle?: string;
  supplierName?: string;
}

interface ExportOptions {
  data: PriceHistoryEntry[];
  format: "csv" | "excel";
  fileName?: string;
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2).replace(".", ",")}%`;
}

function escapeCSVField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function exportPriceHistoryToCSV({ data, fileName = "historico-precos" }: ExportOptions): void {
  const headers = [
    "Produto",
    "Fornecedor",
    "Preço Anterior",
    "Novo Preço",
    "Variação (%)",
    "Data da Alteração",
    "Alerta Enviado",
  ];

  const rows = data.map((entry) => [
    escapeCSVField(entry.productTitle || "Produto desconhecido"),
    escapeCSVField(entry.supplierName || "Fornecedor desconhecido"),
    formatCurrency(entry.old_price),
    formatCurrency(entry.new_price),
    formatPercent(entry.price_change_percent),
    format(parseISO(entry.detected_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    entry.alert_sent ? "Sim" : "Não",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}-${format(new Date(), "yyyy-MM-dd")}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportPriceHistoryToExcel({ data, fileName = "historico-precos" }: ExportOptions): void {
  const headers = [
    "Produto",
    "Fornecedor",
    "Preço Anterior",
    "Novo Preço",
    "Variação (%)",
    "Data da Alteração",
    "Alerta Enviado",
  ];

  const rows = data.map((entry) => [
    entry.productTitle || "Produto desconhecido",
    entry.supplierName || "Fornecedor desconhecido",
    entry.old_price,
    entry.new_price,
    entry.price_change_percent,
    format(parseISO(entry.detected_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    entry.alert_sent ? "Sim" : "Não",
  ]);

  // Create XML spreadsheet format (Excel compatible)
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Histórico de Preços">
  <Table>
   <Row>
    ${headers.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join("")}
   </Row>
   ${rows
     .map(
       (row) => `<Row>
    <Cell><Data ss:Type="String">${escapeXML(String(row[0]))}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXML(String(row[1]))}</Data></Cell>
    <Cell><Data ss:Type="Number">${row[2]}</Data></Cell>
    <Cell><Data ss:Type="Number">${row[3]}</Data></Cell>
    <Cell><Data ss:Type="Number">${row[4]}</Data></Cell>
    <Cell><Data ss:Type="String">${row[5]}</Data></Cell>
    <Cell><Data ss:Type="String">${row[6]}</Data></Cell>
   </Row>`
     )
     .join("\n")}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}-${format(new Date(), "yyyy-MM-dd")}.xls`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generatePriceHistorySummary(data: PriceHistoryEntry[]): {
  totalChanges: number;
  avgChange: number;
  increases: number;
  decreases: number;
  maxIncrease: number;
  maxDecrease: number;
} {
  const increases = data.filter((d) => d.price_change_percent > 0);
  const decreases = data.filter((d) => d.price_change_percent < 0);

  return {
    totalChanges: data.length,
    avgChange: data.length > 0 
      ? data.reduce((sum, d) => sum + d.price_change_percent, 0) / data.length 
      : 0,
    increases: increases.length,
    decreases: decreases.length,
    maxIncrease: increases.length > 0 
      ? Math.max(...increases.map((d) => d.price_change_percent)) 
      : 0,
    maxDecrease: decreases.length > 0 
      ? Math.min(...decreases.map((d) => d.price_change_percent)) 
      : 0,
  };
}
