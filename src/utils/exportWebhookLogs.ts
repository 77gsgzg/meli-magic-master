interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: any;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  created_at: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString('pt-BR');
}

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getWebhookName(webhookId: string, webhooks: Webhook[]): string {
  return webhooks.find((w) => w.id === webhookId)?.name || 'Webhook removido';
}

export function exportWebhookLogsToCSV(logs: WebhookLog[], webhooks: Webhook[]): void {
  const headers = [
    'ID',
    'Webhook',
    'Evento',
    'Status HTTP',
    'Sucesso',
    'Data',
    'Payload',
    'Resposta',
  ];

  const rows = logs.map((log) => [
    escapeCSV(log.id),
    escapeCSV(getWebhookName(log.webhook_id, webhooks)),
    escapeCSV(log.event_type),
    log.response_status?.toString() || '',
    log.success ? 'Sim' : 'Não',
    formatDate(log.created_at),
    escapeCSV(JSON.stringify(log.payload)),
    escapeCSV(log.response_body),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `webhook_logs_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportWebhookLogsToJSON(logs: WebhookLog[], webhooks: Webhook[]): void {
  const enrichedLogs = logs.map((log) => ({
    ...log,
    webhook_name: getWebhookName(log.webhook_id, webhooks),
    payload_parsed: log.payload,
  }));

  const jsonContent = JSON.stringify(enrichedLogs, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `webhook_logs_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportFailedWebhooksToCSV(logs: WebhookLog[], webhooks: Webhook[]): void {
  const failedLogs = logs.filter((l) => !l.success && l.event_type !== 'test');
  
  const headers = [
    'ID',
    'Webhook',
    'Evento',
    'Status HTTP',
    'Data da Falha',
    'Erro',
    'Payload',
  ];

  const rows = failedLogs.map((log) => [
    escapeCSV(log.id),
    escapeCSV(getWebhookName(log.webhook_id, webhooks)),
    escapeCSV(log.event_type),
    log.response_status?.toString() || 'Timeout',
    formatDate(log.created_at),
    escapeCSV(log.response_body?.substring(0, 500)),
    escapeCSV(JSON.stringify(log.payload)),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `webhook_falhas_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
