import jsPDF from "jspdf";

interface UserDetailExport {
  user: {
    id: string;
    masked_email: string;
    full_name: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    confirmed: boolean;
    is_banned: boolean;
    ban_reason?: string | null;
    ban_action?: string | null;
    ban_at?: string | null;
    is_admin: boolean;
  };
  plan: { plan_type: string; status: string; expires_at: string | null };
  ml_integration: any;
  products_count: number;
  sales: { total_orders: number; total_revenue: number; avg_ticket: number };
  usage: { ai_images: number; ai_texts: number; ai_edits: number };
  logs: any[];
  audit_logs: any[];
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR");
}

function fmtBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

/** Mask any free-form value to avoid leaking PII not already masked server-side. */
function safe(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  // strip newlines/quotes for CSV safety
  return s.replace(/"/g, '""').replace(/[\r\n]+/g, " ");
}

function csvLine(cols: (string | number | null | undefined)[]): string {
  return cols.map((c) => `"${safe(c)}"`).join(",");
}

export function exportUserDetailCSV(d: UserDetailExport) {
  const { user, plan, ml_integration, sales, usage, logs, audit_logs } = d;
  const lines: string[] = [];

  lines.push("Seção,Campo,Valor");
  lines.push(csvLine(["Geral", "ID", user.id]));
  lines.push(csvLine(["Geral", "E-mail (mascarado)", user.masked_email]));
  lines.push(csvLine(["Geral", "Nome", user.full_name ?? "—"]));
  lines.push(csvLine(["Geral", "Admin", user.is_admin ? "Sim" : "Não"]));
  lines.push(csvLine(["Geral", "Confirmado", user.confirmed ? "Sim" : "Não"]));
  lines.push(csvLine(["Geral", "Banido", user.is_banned ? "Sim" : "Não"]));
  if (user.is_banned) {
    lines.push(csvLine(["Geral", "Motivo do bloqueio", user.ban_reason ?? "—"]));
    lines.push(csvLine(["Geral", "Ação", user.ban_action ?? "—"]));
    lines.push(csvLine(["Geral", "Data do bloqueio", fmtDate(user.ban_at)]));
  }
  lines.push(csvLine(["Geral", "Criado em", fmtDate(user.created_at)]));
  lines.push(csvLine(["Geral", "Último acesso", fmtDate(user.last_sign_in_at)]));

  lines.push(csvLine(["Plano", "Tipo", plan.plan_type]));
  lines.push(csvLine(["Plano", "Status", plan.status]));
  lines.push(csvLine(["Plano", "Expira em", fmtDate(plan.expires_at)]));

  lines.push(csvLine(["ML", "Conectado", ml_integration?.connected ? "Sim" : "Não"]));
  if (ml_integration?.connected) {
    lines.push(csvLine(["ML", "Nickname", ml_integration.nickname ?? "—"]));
    lines.push(csvLine(["ML", "Token expira em", fmtDate(ml_integration.expires_at)]));
  } else if (ml_integration?.last_revoke_at) {
    lines.push(csvLine(["ML", "Última revogação", fmtDate(ml_integration.last_revoke_at)]));
    lines.push(csvLine(["ML", "Gatilho", ml_integration.last_revoke_trigger ?? "—"]));
    lines.push(csvLine(["ML", "Motivo", ml_integration.last_revoke_reason ?? "—"]));
  }

  lines.push(csvLine(["Vendas", "Total de pedidos", sales.total_orders]));
  lines.push(csvLine(["Vendas", "Receita", fmtBRL(sales.total_revenue)]));
  lines.push(csvLine(["Vendas", "Ticket médio", fmtBRL(sales.avg_ticket)]));

  lines.push(csvLine(["Uso", "Imagens IA", usage.ai_images]));
  lines.push(csvLine(["Uso", "Textos IA", usage.ai_texts]));
  lines.push(csvLine(["Uso", "Edições IA", usage.ai_edits]));

  lines.push("");
  lines.push("Logs");
  lines.push(csvLine(["Quando", "Operação", "Status", "Entidade", "Erro"]));
  logs.forEach((l) =>
    lines.push(
      csvLine([
        fmtDate(l.created_at),
        l.operation_type,
        l.status,
        l.entity_type ?? "",
        l.error_message ?? "",
      ]),
    ),
  );

  lines.push("");
  lines.push("Auditoria administrativa");
  lines.push(csvLine(["Quando", "Ação", "Motivo", "Detalhes"]));
  audit_logs.forEach((a) =>
    lines.push(
      csvLine([
        fmtDate(a.created_at),
        a.action,
        a.reason ?? "",
        a.details ? JSON.stringify(a.details) : "",
      ]),
    ),
  );

  // Resumo final de auditoria
  const auditDates = audit_logs
    .map((a) => a.created_at)
    .filter(Boolean)
    .sort();
  const firstAudit = auditDates[0];
  const lastAudit = auditDates[auditDates.length - 1];
  lines.push("");
  lines.push("Resumo de auditoria");
  lines.push(csvLine(["Total de registros", audit_logs.length]));
  lines.push(csvLine(["Total de logs operacionais", logs.length]));
  lines.push(csvLine(["Primeira ação registrada", fmtDate(firstAudit)]));
  lines.push(csvLine(["Última ação registrada", fmtDate(lastAudit)]));

  // Aviso de mascaramento
  lines.push("");
  lines.push("Aviso de privacidade");
  lines.push(
    csvLine([
      "Mascaramento de dados",
      "Este relatório contém apenas dados mascarados. E-mails, nomes e identificadores pessoais são parcialmente ocultados conforme a política de privacidade. Tokens de integração nunca são exportados.",
    ]),
  );
  lines.push(
    csvLine([
      "Gerado em",
      new Date().toLocaleString("pt-BR"),
    ]),
  );

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `usuario-${user.id.slice(0, 8)}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportUserDetailPDF(d: UserDetailExport) {
  const { user, plan, ml_integration, sales, usage, logs, audit_logs } = d;
  const doc = new jsPDF();
  const margin = 14;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de usuário", margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} • dados sensíveis mascarados`,
    margin,
    y,
  );
  doc.setTextColor(0);
  y += 8;

  function section(title: string) {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, 180, 6, "F");
    doc.text(title, margin + 1, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  }

  function row(label: string, value: string) {
    if (y > 280) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), margin + 55, y, { maxWidth: 130 });
    y += 5;
  }

  section("Informações gerais");
  row("ID:", user.id);
  row("E-mail:", user.masked_email);
  row("Nome:", user.full_name ?? "—");
  row("Admin:", user.is_admin ? "Sim" : "Não");
  row("Confirmado:", user.confirmed ? "Sim" : "Não");
  row("Banido:", user.is_banned ? "Sim" : "Não");
  if (user.is_banned) {
    row("Motivo:", user.ban_reason ?? "—");
    row("Ação:", user.ban_action ?? "—");
    row("Bloqueado em:", fmtDate(user.ban_at));
  }
  row("Criado em:", fmtDate(user.created_at));
  row("Último acesso:", fmtDate(user.last_sign_in_at));

  y += 2;
  section("Plano");
  row("Tipo:", plan.plan_type);
  row("Status:", plan.status);
  row("Expira em:", fmtDate(plan.expires_at));

  y += 2;
  section("Mercado Livre");
  row("Conectado:", ml_integration?.connected ? "Sim" : "Não");
  if (ml_integration?.connected) {
    row("Nickname:", ml_integration.nickname ?? "—");
    row("Token expira:", fmtDate(ml_integration.expires_at));
  } else if (ml_integration?.last_revoke_at) {
    row("Última revogação:", fmtDate(ml_integration.last_revoke_at));
    row("Gatilho:", ml_integration.last_revoke_trigger ?? "—");
    row("Motivo:", ml_integration.last_revoke_reason ?? "—");
  }

  y += 2;
  section("Vendas e uso");
  row("Pedidos:", String(sales.total_orders));
  row("Receita:", fmtBRL(sales.total_revenue));
  row("Ticket médio:", fmtBRL(sales.avg_ticket));
  row("Imagens IA:", String(usage.ai_images));
  row("Textos IA:", String(usage.ai_texts));
  row("Edições IA:", String(usage.ai_edits));

  y += 2;
  section(`Logs recentes (${logs.length})`);
  logs.slice(0, 25).forEach((l) => {
    if (y > 275) {
      doc.addPage();
      y = margin;
    }
    doc.text(
      `${fmtDate(l.created_at)} • ${l.operation_type} • ${l.status}${l.error_message ? " • " + l.error_message.slice(0, 60) : ""}`,
      margin,
      y,
      { maxWidth: 180 },
    );
    y += 4;
  });

  y += 2;
  section(`Auditoria administrativa (${audit_logs.length})`);
  audit_logs.slice(0, 25).forEach((a) => {
    if (y > 275) {
      doc.addPage();
      y = margin;
    }
    doc.text(
      `${fmtDate(a.created_at)} • ${a.action}${a.reason ? " • " + a.reason : ""}`,
      margin,
      y,
      { maxWidth: 180 },
    );
    y += 4;
  });

  // Resumo final de auditoria
  const auditDates = audit_logs
    .map((a) => a.created_at)
    .filter(Boolean)
    .sort();
  const firstAudit = auditDates[0];
  const lastAudit = auditDates[auditDates.length - 1];
  y += 4;
  section("Resumo de auditoria");
  row("Total de registros:", String(audit_logs.length));
  row("Logs operacionais:", String(logs.length));
  row("Primeira ação:", fmtDate(firstAudit));
  row("Última ação:", fmtDate(lastAudit));

  // Aviso de mascaramento
  y += 4;
  if (y > 250) {
    doc.addPage();
    y = margin;
  }
  doc.setFillColor(255, 248, 220);
  doc.setDrawColor(220, 180, 80);
  doc.rect(margin, y - 4, 180, 26, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120, 80, 0);
  doc.text("Aviso de privacidade — dados mascarados", margin + 2, y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(
    "Este relatório contém apenas dados mascarados. E-mails, nomes e identificadores pessoais são parcialmente ocultados conforme a política de privacidade. Tokens de integração nunca são exportados.",
    margin + 2,
    y + 6,
    { maxWidth: 176 },
  );
  doc.setTextColor(0);

  doc.save(`usuario-${user.id.slice(0, 8)}-${Date.now()}.pdf`);
}
