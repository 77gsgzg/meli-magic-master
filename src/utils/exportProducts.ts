import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

const statusLabels: Record<string, string> = {
  published: 'Publicado',
  pending: 'Pendente',
  draft: 'Rascunho',
  error: 'Erro',
  paused: 'Pausado',
};

function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR');
}

function formatPrice(price: number | null): string {
  if (price === null) return '';
  return price.toFixed(2).replace('.', ',');
}

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(products: Product[]): void {
  const headers = [
    'ID',
    'Título',
    'Descrição',
    'Preço',
    'Moeda',
    'Quantidade',
    'Status',
    'Categoria',
    'Condição',
    'Visualizações',
    'Vendas',
    'ID ML',
    'Link ML',
    'IA Otimizada',
    'Criado em',
    'Atualizado em',
    'Publicado em',
  ];

  const rows = products.map((p) => [
    escapeCSV(p.id),
    escapeCSV(p.title),
    escapeCSV(p.description),
    formatPrice(p.price),
    escapeCSV(p.currency),
    p.available_quantity?.toString() || '0',
    statusLabels[p.status || 'draft'] || p.status,
    escapeCSV(p.category_name),
    p.condition === 'new' ? 'Novo' : p.condition === 'used' ? 'Usado' : escapeCSV(p.condition),
    p.views?.toString() || '0',
    p.sales?.toString() || '0',
    escapeCSV(p.ml_item_id),
    escapeCSV(p.ml_permalink),
    p.ai_optimized ? 'Sim' : 'Não',
    formatDate(p.created_at),
    formatDate(p.updated_at),
    formatDate(p.published_at),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  // Add BOM for Excel compatibility with UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `produtos_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(products: Product[]): void {
  // For simplicity, we'll create an HTML table that Excel can open
  const headers = [
    'ID',
    'Título',
    'Descrição',
    'Preço',
    'Moeda',
    'Quantidade',
    'Status',
    'Categoria',
    'Condição',
    'Visualizações',
    'Vendas',
    'ID ML',
    'Link ML',
    'IA Otimizada',
    'Criado em',
    'Atualizado em',
    'Publicado em',
  ];

  const escapeHtml = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const rows = products.map((p) => [
    escapeHtml(p.id),
    escapeHtml(p.title),
    escapeHtml(p.description),
    formatPrice(p.price),
    escapeHtml(p.currency),
    p.available_quantity?.toString() || '0',
    statusLabels[p.status || 'draft'] || p.status,
    escapeHtml(p.category_name),
    p.condition === 'new' ? 'Novo' : p.condition === 'used' ? 'Usado' : escapeHtml(p.condition),
    p.views?.toString() || '0',
    p.sales?.toString() || '0',
    escapeHtml(p.ml_item_id),
    escapeHtml(p.ml_permalink),
    p.ai_optimized ? 'Sim' : 'Não',
    formatDate(p.created_at),
    formatDate(p.updated_at),
    formatDate(p.published_at),
  ]);

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Produtos</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4472C4; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `produtos_${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
